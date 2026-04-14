"""
lookup.py
---------
Fast lookup module for batch-scored Zillow predictions.

Loads the Parquet partitions produced by batch_scorer.py into memory
(or a lazy DuckDB view) and exposes two public functions:

    load_predictions(parcelid)       → dict with predicted_logerror + percentile_rank
    get_cluster_stats(cluster_id)    → dict with mean, std, count for that geo cluster

The module is designed to be imported by the FastAPI app or any notebook /
script that needs sub-millisecond property lookups.

Usage
-----
    from lookup import load_predictions, get_cluster_stats

    result = load_predictions(14538543)
    # {'parcelid': 14538543, 'fips': 6037, 'geo_cluster': 11,
    #  'predicted_logerror': -0.0132, 'percentile_rank': 0.4213}

    stats = get_cluster_stats(11)
    # {'cluster_id': 11, 'mean': -0.0051, 'std': 0.0843, 'count': 116234}
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, Optional, Union

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Global in-memory store ────────────────────────────────────────────────────
# Populated on first call to _ensure_loaded() (lazy, thread-safe read)

_predictions_df: Optional[pd.DataFrame] = None
_cluster_stats: Optional[pd.DataFrame] = None
_parcelid_index: Optional[Dict[int, int]] = None   # parcelid → row position
_predictions_dir: Path = Path("predictions")


# ── Configuration ─────────────────────────────────────────────────────────────

def set_predictions_dir(path: Union[str, Path]) -> None:
    """
    Override the directory where Parquet partitions live.
    Call this before any lookup if your files are not in ./predictions/.
    """
    global _predictions_df, _cluster_stats, _parcelid_index, _predictions_dir
    _predictions_dir = Path(path)
    # Invalidate cache so next lookup re-reads from the new location
    _predictions_df = None
    _cluster_stats   = None
    _parcelid_index  = None


# ── Lazy loader ───────────────────────────────────────────────────────────────

def _ensure_loaded() -> None:
    """Load all Parquet files into memory the first time a lookup is requested."""
    global _predictions_df, _cluster_stats, _parcelid_index

    if _predictions_df is not None:
        return   # already loaded

    parquet_files = sorted(_predictions_dir.glob("fips_*.parquet"))

    if not parquet_files:
        raise FileNotFoundError(
            f"No Parquet files found in '{_predictions_dir}'. "
            "Run batch_scorer.py first to generate predictions."
        )

    logger.info("Loading %d Parquet partitions from '%s' …",
                len(parquet_files), _predictions_dir)

    frames = []
    for fp in parquet_files:
        frames.append(pd.read_parquet(fp, engine="pyarrow"))

    _predictions_df = pd.concat(frames, ignore_index=True)

    # Ensure correct dtypes for fast operations
    _predictions_df["parcelid"]           = _predictions_df["parcelid"].astype(np.int32)
    _predictions_df["fips"]               = _predictions_df["fips"].astype(np.int16)
    _predictions_df["geo_cluster"]        = _predictions_df["geo_cluster"].astype(np.int8)
    _predictions_df["predicted_logerror"] = _predictions_df["predicted_logerror"].astype(np.float32)
    _predictions_df["percentile_rank"]    = _predictions_df["percentile_rank"].astype(np.float32)

    # Build O(1) parcelid lookup: parcelid → integer row index
    _parcelid_index = dict(
        zip(_predictions_df["parcelid"].values,
            range(len(_predictions_df)))
    )

    # Pre-compute cluster statistics
    _cluster_stats = (
        _predictions_df
        .groupby("geo_cluster")["predicted_logerror"]
        .agg(mean="mean", std="std", count="count")
        .reset_index()
        .rename(columns={"geo_cluster": "cluster_id"})
    )
    _cluster_stats["mean"]  = _cluster_stats["mean"].astype(np.float32)
    _cluster_stats["std"]   = _cluster_stats["std"].astype(np.float32)
    _cluster_stats["count"] = _cluster_stats["count"].astype(np.int32)

    logger.info(
        "Loaded %d predictions covering %d clusters  (RAM ≈ %.1f MiB)",
        len(_predictions_df),
        len(_cluster_stats),
        _predictions_df.memory_usage(deep=True).sum() / 1_048_576,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def load_predictions(parcelid: int) -> Dict[str, Any]:
    """
    Return prediction details for a single property.

    Parameters
    ----------
    parcelid : int
        The Zillow parcel identifier.

    Returns
    -------
    dict with keys:
        parcelid          int
        fips              int   (county FIPS code)
        geo_cluster       int   (spatial cluster 0–24)
        predicted_logerror float
        percentile_rank   float (0–1, fraction of properties with lower prediction)

    Raises
    ------
    KeyError
        If *parcelid* is not present in the scored dataset.
    TypeError
        If *parcelid* cannot be cast to int.
    """
    try:
        pid = int(parcelid)
    except (ValueError, TypeError) as exc:
        raise TypeError(f"parcelid must be an integer, got {type(parcelid).__name__!r}") from exc

    _ensure_loaded()

    row_idx = _parcelid_index.get(pid)
    if row_idx is None:
        raise KeyError(
            f"parcelid {pid} not found in scored predictions. "
            "It may not have been present in properties_2016.csv, "
            "or the property was skipped due to missing data."
        )

    row = _predictions_df.iloc[row_idx]
    return {
        "parcelid":           int(row["parcelid"]),
        "fips":               int(row["fips"]),
        "geo_cluster":        int(row["geo_cluster"]),
        "predicted_logerror": float(row["predicted_logerror"]),
        "percentile_rank":    float(row["percentile_rank"]),
    }


def get_cluster_stats(cluster_id: int) -> Dict[str, Any]:
    """
    Return aggregate prediction statistics for a geo cluster.

    Parameters
    ----------
    cluster_id : int
        Spatial cluster identifier (0–24 with k=25 KMeans).

    Returns
    -------
    dict with keys:
        cluster_id  int
        mean        float  – mean predicted logerror across all properties
        std         float  – standard deviation
        count       int    – number of properties in cluster

    Raises
    ------
    KeyError
        If *cluster_id* is not in the scored data.
    TypeError
        If *cluster_id* cannot be cast to int.
    """
    try:
        cid = int(cluster_id)
    except (ValueError, TypeError) as exc:
        raise TypeError(f"cluster_id must be an integer, got {type(cluster_id).__name__!r}") from exc

    _ensure_loaded()

    row = _cluster_stats[_cluster_stats["cluster_id"] == cid]
    if row.empty:
        raise KeyError(
            f"cluster_id {cid} not found in scored predictions. "
            f"Valid range: {_cluster_stats['cluster_id'].min()}–"
            f"{_cluster_stats['cluster_id'].max()}."
        )

    r = row.iloc[0]
    return {
        "cluster_id": int(r["cluster_id"]),
        "mean":        round(float(r["mean"]),  6),
        "std":         round(float(r["std"]),   6),
        "count":       int(r["count"]),
    }


def list_clusters() -> pd.DataFrame:
    """
    Return a DataFrame of all cluster statistics sorted by cluster_id.
    Useful for dashboards and exploratory analysis.
    """
    _ensure_loaded()
    return _cluster_stats.sort_values("cluster_id").reset_index(drop=True)


def lookup_batch(parcelids: list) -> pd.DataFrame:
    """
    Vectorised lookup for multiple parcelids.

    Parameters
    ----------
    parcelids : list of int
        Property identifiers to look up.

    Returns
    -------
    pd.DataFrame
        One row per found parcelid.  Rows for missing parcelids are silently
        omitted; check the length vs. input to detect gaps.
    """
    _ensure_loaded()
    pids = [int(p) for p in parcelids]
    idxs = [_parcelid_index[p] for p in pids if p in _parcelid_index]
    if not idxs:
        return pd.DataFrame(columns=list(_predictions_df.columns))
    return _predictions_df.iloc[idxs].reset_index(drop=True)


# ── Quick self-test (run as script) ───────────────────────────────────────────

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(message)s")

    pred_dir = sys.argv[1] if len(sys.argv) > 1 else "predictions"
    set_predictions_dir(pred_dir)

    _ensure_loaded()
    print(f"\nLoaded {len(_predictions_df):,} predictions.")

    # Sample a random parcelid and look it up
    sample_pid = int(_predictions_df["parcelid"].sample(1).iloc[0])
    print("\n=== load_predictions ===")
    print(load_predictions(sample_pid))

    # Cluster stats for the first cluster
    sample_cluster = int(_predictions_df["geo_cluster"].iloc[0])
    print("\n=== get_cluster_stats ===")
    print(get_cluster_stats(sample_cluster))

    print("\n=== list_clusters (first 5 rows) ===")
    print(list_clusters().head())
