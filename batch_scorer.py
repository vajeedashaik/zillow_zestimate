"""
batch_scorer.py
---------------
Scalable batch scoring pipeline for the Zillow Zestimate stacked ensemble.

Reads properties_2016.csv in chunks of 50,000 rows, applies the exact same
feature engineering pipeline from Model.py, runs the XGB+LGB+CatBoost+Ridge
stacked ensemble, and writes results as partitioned Parquet files (one per
county FIPS).

Usage
-----
    python batch_scorer.py [--input PATH] [--output-dir PATH] [--chunk-size N]

Artifacts Required (in ./models/)
----------------------------------
    geo_scaler.joblib, kmeans.joblib, xgb_model.joblib, lgb_model.joblib,
    cat_model.joblib, meta_model.joblib, feature_columns.joblib,
    geo_cluster_means.joblib, county_means.joblib, cluster_density.joblib,
    cluster_agg.joblib, train_medians.joblib, global_mean.joblib

Output Schema (per Parquet partition)
---------------------------------------
    parcelid          int32     – property identifier
    fips              int16     – county FIPS code
    geo_cluster       int8      – spatial cluster (0–24)
    predicted_logerror float32  – model output
    percentile_rank   float32   – pct rank among all scored properties
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import psutil
from tqdm import tqdm

# ── Project imports ────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from model_loader import load_artifacts
from feature_engineering import ModelArtifacts

# ── Logging setup ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("batch_scorer.log", mode="w"),
    ],
)
logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
DEFAULT_CHUNK_SIZE = 50_000
DEFAULT_INPUT = "properties_2016.csv"
DEFAULT_OUTPUT_DIR = "predictions"

# dtype map matching Model.py (minimises RAM during CSV read)
DTYPE_MAP: Dict[str, str] = {
    "parcelid":                       "Int32",
    "bathroomcnt":                    "float32",
    "bedroomcnt":                     "float32",
    "calculatedfinishedsquarefeet":   "float32",
    "finishedsquarefeet12":           "float32",
    "fips":                           "Int16",
    "latitude":                       "float32",
    "longitude":                      "float32",
    "lotsizesquarefeet":              "float32",
    "taxamount":                      "float32",
    "taxvaluedollarcnt":              "float32",
    "structuretaxvaluedollarcnt":     "float32",
    "landtaxvaluedollarcnt":          "float32",
    "yearbuilt":                      "float32",
}

# ── Helper: memory usage ───────────────────────────────────────────────────────

def _rss_mb() -> float:
    """Return resident memory of the current process in MiB."""
    return psutil.Process(os.getpid()).memory_info().rss / 1_048_576


# ── Vectorised feature engineering for a DataFrame chunk ─────────────────────

def _engineer_chunk(chunk: pd.DataFrame, artifacts: ModelArtifacts) -> pd.DataFrame:
    """
    Apply the exact Model.py feature engineering pipeline to a DataFrame chunk.

    Parameters
    ----------
    chunk : pd.DataFrame
        Raw rows from properties_2016.csv (may contain NaNs).
    artifacts : ModelArtifacts
        Loaded model artifacts (scalers, encoders, lookup tables).

    Returns
    -------
    pd.DataFrame
        One row per valid property, columns aligned to artifacts.feature_columns,
        dtype float32.  Rows that cannot be processed are dropped and logged.
    """
    df = chunk.copy()

    # ── 1. Latitude / Longitude (Zillow stores as integer × 1e6) ──────────────
    df["latitude"]  = df["latitude"].astype("float32")  / 1e6
    df["longitude"] = df["longitude"].astype("float32") / 1e6

    lat_med = float(artifacts.train_medians.get("latitude",  33.95))
    lon_med = float(artifacts.train_medians.get("longitude", -118.25))
    df["latitude"]  = df["latitude"].fillna(lat_med)
    df["longitude"] = df["longitude"].fillna(lon_med)

    # ── 2. Spatial clustering ──────────────────────────────────────────────────
    geo_arr    = df[["latitude", "longitude"]].values.astype(np.float64)
    geo_scaled = artifacts.geo_scaler.transform(geo_arr)
    df["geo_cluster"] = artifacts.kmeans.predict(geo_scaled).astype(np.int8)

    # ── 3. Fixed transaction date (October 2016 – same as Model.py test set) ──
    TX_YEAR, TX_MONTH, TX_QUARTER, TX_DOW = 2016, 10, 4, 0
    df["transaction_year"]      = np.int16(TX_YEAR)
    df["transaction_month"]     = np.int8(TX_MONTH)
    df["transaction_quarter"]   = np.int8(TX_QUARTER)
    df["transaction_dayofweek"] = np.int8(TX_DOW)

    # ── 4. Cyclical month encoding ─────────────────────────────────────────────
    df["month_sin"] = np.sin(2 * np.pi * TX_MONTH / 12).astype(np.float32)
    df["month_cos"] = np.cos(2 * np.pi * TX_MONTH / 12).astype(np.float32)

    # ── 5. Property age ────────────────────────────────────────────────────────
    yb_med = float(artifacts.train_medians.get("yearbuilt", 1955.0))
    df["yearbuilt"] = df["yearbuilt"].fillna(yb_med)
    df["property_age"] = (TX_YEAR - df["yearbuilt"]).astype(np.float32)

    # ── 6. Tax & area ratios ───────────────────────────────────────────────────
    for col in ["taxamount", "taxvaluedollarcnt",
                "structuretaxvaluedollarcnt", "landtaxvaluedollarcnt",
                "calculatedfinishedsquarefeet", "lotsizesquarefeet"]:
        if col in df.columns:
            df[col] = df[col].fillna(artifacts.train_medians.get(col, 0.0))
        else:
            df[col] = float(artifacts.train_medians.get(col, 0.0))

    df["tax_ratio"]            = df["taxamount"] / (df["taxvaluedollarcnt"] + 1)
    df["structure_land_ratio"] = (df["structuretaxvaluedollarcnt"]
                                  / (df["landtaxvaluedollarcnt"] + 1))
    df["living_area_ratio"]    = (df["calculatedfinishedsquarefeet"]
                                  / (df["lotsizesquarefeet"] + 1))

    # ── 7. Total bathrooms ─────────────────────────────────────────────────────
    fb_med = float(artifacts.train_medians.get("fullbathcnt", 2.0))
    if "fullbathcnt" in df.columns:
        df["fullbathcnt"] = df["fullbathcnt"].fillna(fb_med)
    else:
        df["fullbathcnt"] = fb_med

    if "threequarterbathnbr" in df.columns:
        df["threequarterbathnbr"] = df["threequarterbathnbr"].fillna(0.0)
        df["total_bath"] = df["fullbathcnt"] + 0.75 * df["threequarterbathnbr"]
    else:
        df["total_bath"] = df["fullbathcnt"]

    # ── 8. Cluster density ────────────────────────────────────────────────────
    df["geo_cluster_density"] = (
        df["geo_cluster"]
        .map(artifacts.cluster_density)
        .fillna(0)
        .astype(np.float32)
    )

    # ── 9. Cluster aggregation (mean tax value & area per cluster) ────────────
    agg_df = artifacts.cluster_agg.reset_index()   # geo_cluster column restored
    df = df.merge(agg_df[["geo_cluster", "cluster_mean_tax", "cluster_mean_area"]],
                  on="geo_cluster", how="left")
    cmt_med = float(artifacts.train_medians.get("cluster_mean_tax",  0.0))
    cma_med = float(artifacts.train_medians.get("cluster_mean_area", 0.0))
    df["cluster_mean_tax"]  = df["cluster_mean_tax"].fillna(cmt_med)
    df["cluster_mean_area"] = df["cluster_mean_area"].fillna(cma_med)

    # ── 10. County from FIPS ──────────────────────────────────────────────────
    # fips is Int16 (nullable); convert to plain string without "<NA>"
    df["county"] = (
        df["fips"]
        .fillna(0)
        .astype(int)
        .astype(str)
    )

    # ── 11. Target encoding ───────────────────────────────────────────────────
    gm = artifacts.global_mean
    df["geo_cluster_te"] = (
        df["geo_cluster"]
        .map(artifacts.geo_cluster_means)
        .fillna(gm)
        .astype(np.float32)
    )
    df["county_te"] = (
        df["county"]
        .map(artifacts.county_means)
        .fillna(gm)
        .astype(np.float32)
    )

    # ── 12. Age-cluster interaction ───────────────────────────────────────────
    df["age_cluster_interaction"] = (
        df["property_age"] * df["geo_cluster"].astype(np.float32)
    )

    # ── 13. Missing indicator flags ───────────────────────────────────────────
    #  Replicate Model.py: for each *_missing_flag column in feature_columns,
    #  flag = 1 iff the base column was originally NaN in this chunk.
    #  We use the ORIGINAL chunk (pre-imputation) to detect missingness.
    for fc in artifacts.feature_columns:
        if fc.endswith("_missing_flag"):
            base = fc[: -len("_missing_flag")]
            if base in chunk.columns:
                df[fc] = chunk[base].isnull().astype(np.int8).values
            else:
                df[fc] = np.int8(0)

    # ── 14. Impute remaining NaN with training medians ────────────────────────
    for fc in artifacts.feature_columns:
        if fc not in df.columns:
            df[fc] = 0.0
        elif df[fc].isnull().any():
            df[fc] = df[fc].fillna(artifacts.train_medians.get(fc, 0.0))

    # ── 15. Align to exact training feature space ─────────────────────────────
    X = df[artifacts.feature_columns].astype(np.float32)
    return X


# ── Ensemble predict ──────────────────────────────────────────────────────────

def _predict_chunk(X: pd.DataFrame, artifacts: ModelArtifacts) -> np.ndarray:
    """Run base models → stack → meta predict. Returns float32 array."""
    xgb_p = artifacts.xgb_model.predict(X)
    lgb_p = artifacts.lgb_model.predict(X)
    cat_p = artifacts.cat_model.predict(X)

    stack = pd.DataFrame({"xgb": xgb_p, "lgb": lgb_p, "cat": cat_p})
    return artifacts.meta_model.predict(stack).astype(np.float32)


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_batch_scoring(
    input_path: str = DEFAULT_INPUT,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    models_dir: Optional[str] = None,
) -> Dict[str, str]:
    """
    Score all properties in *input_path* and write partitioned Parquet files.

    Parameters
    ----------
    input_path  : path to properties_2016.csv
    output_dir  : directory to write Parquet files
    chunk_size  : rows per chunk (default 50,000)
    models_dir  : path to serialised artifacts; defaults to ./models/

    Returns
    -------
    dict mapping fips_string → parquet_path for each county written.
    """
    t_start = time.perf_counter()
    logger.info("=" * 70)
    logger.info("Zillow Batch Scoring Pipeline")
    logger.info("Input  : %s", input_path)
    logger.info("Output : %s", output_dir)
    logger.info("Chunk  : %d rows", chunk_size)
    logger.info("=" * 70)

    # ── Load artifacts ─────────────────────────────────────────────────────────
    logger.info("Loading model artifacts …")
    artifacts_path = Path(models_dir) if models_dir else None
    if artifacts_path:
        from model_loader import load_artifacts as _load
        artifacts = _load(artifacts_path)
    else:
        artifacts = load_artifacts()
    logger.info("Artifacts loaded. Feature count: %d  |  RAM: %.1f MiB",
                len(artifacts.feature_columns), _rss_mb())

    # ── Output directory ───────────────────────────────────────────────────────
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Count total rows for tqdm ─────────────────────────────────────────────
    logger.info("Counting rows in %s …", input_path)
    total_rows = sum(1 for _ in open(input_path, "r", encoding="utf-8")) - 1
    total_chunks = (total_rows + chunk_size - 1) // chunk_size
    logger.info("Total rows: %d  |  Estimated chunks: %d", total_rows, total_chunks)

    # ── Accumulate results per county ─────────────────────────────────────────
    # We keep lightweight buffers {fips_str: list of (parcelids, clusters, preds)}
    results: Dict[str, List[pd.DataFrame]] = {}
    chunk_times: List[float] = []
    skipped_rows = 0

    reader = pd.read_csv(
        input_path,
        dtype=DTYPE_MAP,
        low_memory=False,
        chunksize=chunk_size,
    )

    with tqdm(total=total_chunks, unit="chunk", desc="Scoring") as pbar:
        for chunk_idx, chunk in enumerate(reader):
            t_chunk = time.perf_counter()

            # ── Pre-flight: drop rows with no parcelid ────────────────────────
            before = len(chunk)
            chunk = chunk.dropna(subset=["parcelid"])
            skipped_rows += before - len(chunk)

            if chunk.empty:
                pbar.update(1)
                continue

            # Snapshot parcelid + fips before feature engineering modifies df
            parcelids = chunk["parcelid"].values.astype(np.int32)
            fips_vals = (
                chunk["fips"]
                .fillna(0)
                .astype(int)
                .values
                .astype(np.int16)
            )

            try:
                X = _engineer_chunk(chunk, artifacts)
                preds = _predict_chunk(X, artifacts)
            except Exception:
                logger.warning("Chunk %d failed — skipping %d rows:\n%s",
                               chunk_idx, len(chunk),
                               traceback.format_exc())
                skipped_rows += len(chunk)
                pbar.update(1)
                continue

            # ── Snapshot geo_cluster for the result frame ─────────────────────
            geo_clusters = X["geo_cluster"].values.astype(np.int8) if "geo_cluster" in X.columns else np.zeros(len(X), dtype=np.int8)

            # ── Store per-county ──────────────────────────────────────────────
            frame = pd.DataFrame({
                "parcelid":           parcelids,
                "fips":               fips_vals,
                "geo_cluster":        geo_clusters,
                "predicted_logerror": preds,
            })

            for fips_val, grp in frame.groupby("fips"):
                key = str(fips_val)
                if key not in results:
                    results[key] = []
                results[key].append(grp)

            # ── Chunk timing & logging ─────────────────────────────────────────
            elapsed = time.perf_counter() - t_chunk
            chunk_times.append(elapsed)
            pbar.set_postfix({
                "rows": len(chunk),
                "s/chunk": f"{elapsed:.2f}",
                "RAM MiB": f"{_rss_mb():.0f}",
            })
            pbar.update(1)

    # ── Compute percentile ranks globally ─────────────────────────────────────
    logger.info("Computing global percentile ranks …")

    all_frames = [df for frames in results.values() for df in frames]
    if not all_frames:
        logger.error("No predictions produced — check input file and artifacts.")
        return {}

    full_df = pd.concat(all_frames, ignore_index=True)
    full_df["percentile_rank"] = (
        full_df["predicted_logerror"]
        .rank(pct=True)
        .astype(np.float32)
    )

    # ── Write one Parquet per county ──────────────────────────────────────────
    logger.info("Writing Parquet partitions …")
    written: Dict[str, str] = {}

    for fips_key, grp in full_df.groupby("fips"):
        fname = f"fips_{fips_key}.parquet"
        fpath = out_dir / fname
        grp.reset_index(drop=True).to_parquet(
            fpath,
            engine="pyarrow",
            index=False,
            compression="snappy",
        )
        written[str(fips_key)] = str(fpath)
        logger.info("  Wrote %s  (%d rows)", fpath, len(grp))

    # ── Summary ───────────────────────────────────────────────────────────────
    total_scored = len(full_df)
    wall_time = time.perf_counter() - t_start
    avg_chunk = np.mean(chunk_times) if chunk_times else 0.0

    logger.info("=" * 70)
    logger.info("Scoring complete.")
    logger.info("  Total scored      : %d", total_scored)
    logger.info("  Skipped rows      : %d", skipped_rows)
    logger.info("  Wall time         : %.1f s", wall_time)
    logger.info("  Avg time / chunk  : %.2f s", avg_chunk)
    logger.info("  Throughput        : %.0f rows/s", total_scored / max(wall_time, 1e-9))
    logger.info("  Peak RAM          : %.1f MiB", _rss_mb())
    logger.info("  Parquet files     : %s", list(written.values()))
    logger.info("=" * 70)

    # Persist timing metadata alongside predictions
    meta = {
        "total_scored":    total_scored,
        "skipped_rows":    skipped_rows,
        "wall_time_s":     round(wall_time, 2),
        "avg_chunk_s":     round(avg_chunk, 4),
        "throughput_rows_per_s": round(total_scored / max(wall_time, 1e-9), 1),
        "peak_ram_mib":    round(_rss_mb(), 1),
        "chunk_size":      chunk_size,
        "parquet_files":   written,
    }
    with open(out_dir / "run_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    return written


# ── CLI entry point ────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Zillow batch scoring pipeline")
    p.add_argument("--input",      default=DEFAULT_INPUT,      help="Path to properties_2016.csv")
    p.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Output directory for Parquet files")
    p.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE, help="Rows per chunk")
    p.add_argument("--models-dir", default=None, help="Path to models/ directory (optional override)")
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    run_batch_scoring(
        input_path=args.input,
        output_dir=args.output_dir,
        chunk_size=args.chunk_size,
        models_dir=args.models_dir,
    )
