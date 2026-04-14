"""
feature_engineering.py
-----------------------
Replicates the exact feature engineering pipeline from Model.py so that
inference-time features match what the models were trained on.

The ModelArtifacts dataclass (populated by model_loader.py) carries all the
fitted transformers and lookup tables needed to reproduce training-time
transformations on a single property dict.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Artifact container (filled by model_loader, consumed here)
# ---------------------------------------------------------------------------

@dataclass
class ModelArtifacts:
    geo_scaler: Any           # sklearn StandardScaler fitted on [lat, lon]
    kmeans: Any               # sklearn KMeans (n_clusters=25)
    xgb_model: Any
    lgb_model: Any
    cat_model: Any
    meta_model: Any           # Ridge meta-learner
    feature_columns: List[str]   # exact ordered list used at train time
    geo_cluster_means: Dict[int, float]   # cluster → mean logerror
    county_means: Dict[str, float]        # county str → mean logerror
    cluster_density: Dict[int, int]       # cluster → count
    cluster_agg: pd.DataFrame            # cluster_mean_tax, cluster_mean_area
    train_medians: Dict[str, float]      # column → median for imputation
    global_mean: float                   # fallback for unseen target-encode keys


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

def _safe_get(d: dict, key: str, default: float = 0.0) -> float:
    v = d.get(key)
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return default
    return float(v)


def engineer_features(prop: dict, artifacts: ModelArtifacts) -> pd.DataFrame:
    """
    Transform a single property dictionary into a feature row aligned
    with the training feature matrix.

    Parameters
    ----------
    prop : dict
        Keys matching PropertyInput fields (plus any extras are ignored).
    artifacts : ModelArtifacts
        Loaded model artifacts.

    Returns
    -------
    pd.DataFrame with exactly one row and columns == artifacts.feature_columns.
    Raises ValueError on invalid input that would corrupt predictions.
    """

    row: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # 1. Raw numeric fields (with median fallback from training data)
    # ------------------------------------------------------------------
    def med(col: str) -> float:
        return artifacts.train_medians.get(col, 0.0)

    taxamount = prop.get("taxamount") or med("taxamount")
    taxvalue  = prop.get("taxvaluedollarcnt") or med("taxvaluedollarcnt")

    # calculatedfinishedsquarefeet falls back to finishedsquarefeet12
    calc_sf = (
        prop.get("calculatedfinishedsquarefeet")
        or prop.get("finishedsquarefeet12")
        or med("calculatedfinishedsquarefeet")
    )
    lot_sf      = prop.get("lotsizesquarefeet") or med("lotsizesquarefeet")
    yearbuilt   = prop.get("yearbuilt") or med("yearbuilt")
    struct_tax  = prop.get("structuretaxvaluedollarcnt") or med("structuretaxvaluedollarcnt")
    land_tax    = prop.get("landtaxvaluedollarcnt") or med("landtaxvaluedollarcnt")
    fullbath    = prop.get("fullbathcnt") or med("fullbathcnt")
    threequart  = prop.get("threequarterbathnbr") or 0.0

    # Pass raw numeric fields through so the model sees them
    row["taxamount"]              = taxamount
    row["taxvaluedollarcnt"]      = taxvalue
    row["finishedsquarefeet12"]   = prop.get("finishedsquarefeet12") or med("finishedsquarefeet12")
    row["lotsizesquarefeet"]      = lot_sf
    row["yearbuilt"]              = yearbuilt
    row["structuretaxvaluedollarcnt"] = struct_tax
    row["landtaxvaluedollarcnt"]  = land_tax
    row["fullbathcnt"]            = fullbath
    row["calculatedfinishedsquarefeet"] = calc_sf

    # ------------------------------------------------------------------
    # 2. Latitude / longitude (API receives decimal degrees, not 1e6 ints)
    # ------------------------------------------------------------------
    latitude  = float(prop["latitude"])
    longitude = float(prop["longitude"])

    # If someone passes the raw Zillow integers (>90), auto-scale them
    if abs(latitude) > 90:
        latitude /= 1e6
    if abs(longitude) > 360:
        longitude /= 1e6

    row["latitude"]  = latitude
    row["longitude"] = longitude

    # ------------------------------------------------------------------
    # 3. Transaction date features
    # ------------------------------------------------------------------
    txdate = prop["transactiondate"]          # datetime.date or str
    if isinstance(txdate, str):
        txdate = pd.to_datetime(txdate).date()

    tx_year  = txdate.year
    tx_month = txdate.month
    tx_quarter = (tx_month - 1) // 3 + 1
    tx_dow   = pd.Timestamp(txdate).dayofweek

    row["transaction_year"]      = tx_year
    row["transaction_month"]     = tx_month
    row["transaction_quarter"]   = tx_quarter
    row["transaction_dayofweek"] = tx_dow

    # ------------------------------------------------------------------
    # 4. Cyclical month encoding
    # ------------------------------------------------------------------
    row["month_sin"] = math.sin(2 * math.pi * tx_month / 12)
    row["month_cos"] = math.cos(2 * math.pi * tx_month / 12)

    # ------------------------------------------------------------------
    # 5. Property age
    # ------------------------------------------------------------------
    row["property_age"] = tx_year - yearbuilt

    # ------------------------------------------------------------------
    # 6. Tax and area ratios
    # ------------------------------------------------------------------
    row["tax_ratio"]           = taxamount / (taxvalue + 1)
    row["structure_land_ratio"] = struct_tax / (land_tax + 1)
    row["living_area_ratio"]   = calc_sf / (lot_sf + 1)

    # ------------------------------------------------------------------
    # 7. Total bathrooms
    # ------------------------------------------------------------------
    row["total_bath"] = fullbath + 0.75 * threequart

    # ------------------------------------------------------------------
    # 8. Geo cluster assignment (use fitted scaler + kmeans)
    # ------------------------------------------------------------------
    geo_arr = np.array([[latitude, longitude]], dtype=float)
    geo_scaled = artifacts.geo_scaler.transform(geo_arr)
    cluster = int(artifacts.kmeans.predict(geo_scaled)[0])
    row["geo_cluster"] = cluster

    # ------------------------------------------------------------------
    # 9. Cluster density
    # ------------------------------------------------------------------
    row["geo_cluster_density"] = float(
        artifacts.cluster_density.get(cluster, 0)
    )

    # ------------------------------------------------------------------
    # 10. Cluster aggregation (mean tax value, mean area per cluster)
    # ------------------------------------------------------------------
    agg_row = artifacts.cluster_agg[
        artifacts.cluster_agg.index == cluster
    ]
    if not agg_row.empty:
        row["cluster_mean_tax"]  = float(agg_row["cluster_mean_tax"].iloc[0])
        row["cluster_mean_area"] = float(agg_row["cluster_mean_area"].iloc[0])
    else:
        row["cluster_mean_tax"]  = artifacts.train_medians.get("cluster_mean_tax", 0.0)
        row["cluster_mean_area"] = artifacts.train_medians.get("cluster_mean_area", 0.0)

    # ------------------------------------------------------------------
    # 11. County from FIPS
    # ------------------------------------------------------------------
    county = str(int(prop["fips"]))
    row["county"] = county           # kept for reference (not numeric)

    # ------------------------------------------------------------------
    # 12. Target encoding (geo_cluster + county)
    # ------------------------------------------------------------------
    row["geo_cluster_te"] = artifacts.geo_cluster_means.get(
        cluster, artifacts.global_mean
    )
    row["county_te"] = artifacts.county_means.get(
        county, artifacts.global_mean
    )

    # ------------------------------------------------------------------
    # 13. Geo-age interaction
    # ------------------------------------------------------------------
    row["age_cluster_interaction"] = row["property_age"] * cluster

    # ------------------------------------------------------------------
    # 14. Align to training feature columns
    #     - Any column not in training is dropped
    #     - Any missing training column is filled with 0
    # ------------------------------------------------------------------
    df = pd.DataFrame([row])

    for col in artifacts.feature_columns:
        if col not in df.columns:
            df[col] = 0.0

    # Drop columns not seen during training (e.g. 'county' str col)
    df = df[[c for c in artifacts.feature_columns if c in df.columns]]

    # Re-order to exact training order
    df = df[artifacts.feature_columns]

    # Ensure float32 dtype consistency
    for col in df.columns:
        df[col] = df[col].astype("float32")

    return df


def engineer_features_batch(
    props: list, artifacts: ModelArtifacts
) -> pd.DataFrame:
    """Vectorised version for batch predictions."""
    frames = [engineer_features(p, artifacts) for p in props]
    return pd.concat(frames, ignore_index=True)
