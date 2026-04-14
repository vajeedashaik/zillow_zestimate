"""
model_loader.py
---------------
Loads all joblib artifacts produced by save_models.py at startup.
Returns a populated ModelArtifacts instance or raises a clear error
so the health endpoint can report degraded status instead of a 500.
"""

from __future__ import annotations

import logging
from pathlib import Path

import joblib
import pandas as pd

from feature_engineering import ModelArtifacts

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"

# Mapping: attribute name → filename inside models/
ARTIFACT_FILES = {
    "geo_scaler":          "geo_scaler.joblib",
    "kmeans":              "kmeans.joblib",
    "xgb_model":           "xgb_model.joblib",
    "lgb_model":           "lgb_model.joblib",
    "cat_model":           "cat_model.joblib",
    "meta_model":          "meta_model.joblib",
    "feature_columns":     "feature_columns.joblib",
    "geo_cluster_means":   "geo_cluster_means.joblib",
    "county_means":        "county_means.joblib",
    "cluster_density":     "cluster_density.joblib",
    "cluster_agg":         "cluster_agg.joblib",
    "train_medians":       "train_medians.joblib",
    "global_mean":         "global_mean.joblib",
}


def load_artifacts(models_dir: Path = MODELS_DIR) -> ModelArtifacts:
    """
    Load every artifact from *models_dir* and return a ModelArtifacts instance.

    Raises
    ------
    FileNotFoundError
        If any required artifact file is missing.
    RuntimeError
        If deserialization fails.
    """
    loaded: dict = {}
    missing = []

    for attr, filename in ARTIFACT_FILES.items():
        path = models_dir / filename
        if not path.exists():
            missing.append(str(path))
            continue
        try:
            loaded[attr] = joblib.load(path)
            logger.info("Loaded artifact: %s", filename)
        except Exception as exc:
            raise RuntimeError(f"Failed to load {filename}: {exc}") from exc

    if missing:
        raise FileNotFoundError(
            "Missing model artifact files. Run save_models.py first.\n"
            + "\n".join(f"  {p}" for p in missing)
        )

    # cluster_agg is stored as a DataFrame; ensure the index is geo_cluster
    agg: pd.DataFrame = loaded["cluster_agg"]
    if "geo_cluster" in agg.columns:
        agg = agg.set_index("geo_cluster")
    loaded["cluster_agg"] = agg

    # geo_cluster_means / county_means may be stored as pd.Series → convert to dict
    for key in ("geo_cluster_means", "county_means"):
        val = loaded[key]
        if isinstance(val, pd.Series):
            loaded[key] = val.to_dict()

    # train_medians may also be a Series
    tm = loaded["train_medians"]
    if isinstance(tm, pd.Series):
        loaded["train_medians"] = tm.to_dict()

    return ModelArtifacts(**loaded)
