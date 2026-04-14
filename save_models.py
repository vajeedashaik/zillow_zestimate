"""
save_models.py
--------------
Run this script ONCE after training in Model.py (or in Colab) to serialize
all artifacts that the FastAPI service needs.

Usage (in the same Colab/notebook session where Model.py finished):

    exec(open("save_models.py").read())

Or paste the contents into a final Colab cell.

What gets saved (into ./models/):
    geo_scaler.joblib        – sklearn StandardScaler for lat/lon
    kmeans.joblib            – sklearn KMeans (25 clusters)
    xgb_model.joblib         – final XGBoost model
    lgb_model.joblib         – final LightGBM model
    cat_model.joblib         – final CatBoost model
    meta_model.joblib        – Ridge meta-learner
    feature_columns.joblib   – ordered list of training feature names
    geo_cluster_means.joblib – dict {cluster_id: mean_logerror}
    county_means.joblib      – dict {county_str: mean_logerror}
    cluster_density.joblib   – dict {cluster_id: count}
    cluster_agg.joblib       – DataFrame with cluster_mean_tax/area
    train_medians.joblib     – dict {column: median_value}
    global_mean.joblib       – float (global mean logerror, fallback)
"""

import os
import joblib
import pandas as pd

# ── Make sure this runs in the same Python session as Model.py ──────────────
# The variables below must already exist in scope.

MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)


def _save(name: str, obj) -> None:
    path = os.path.join(MODELS_DIR, name)
    joblib.dump(obj, path, compress=3)
    print(f"  Saved: {path}")


print("Saving model artifacts to ./models/ …")

# 1. Geo transformers
_save("geo_scaler.joblib", geo_scaler)
_save("kmeans.joblib",     kmeans)

# 2. Base models
_save("xgb_model.joblib", final_xgb)
_save("lgb_model.joblib", final_lgb)
_save("cat_model.joblib", final_cat)

# 3. Meta-learner
_save("meta_model.joblib", meta_model)

# 4. Feature column order (must match training X_numeric exactly)
_save("feature_columns.joblib", list(X_numeric.columns))

# 5. Target encoding lookup tables
_save("geo_cluster_means.joblib", geo_cluster_means.to_dict())
_save("county_means.joblib",      county_means.to_dict())

# 6. Cluster density + aggregation
_save("cluster_density.joblib", cluster_density)

# cluster_agg needs geo_cluster as a regular column for storage
cluster_agg_save = cluster_agg.reset_index()   # makes geo_cluster a column
_save("cluster_agg.joblib", cluster_agg_save)

# 7. Training medians (for inference-time imputation)
train_medians_dict = df.median(numeric_only=True).to_dict()
_save("train_medians.joblib", train_medians_dict)

# 8. Global mean logerror (fallback for unseen target-encode keys)
global_mean_val = float(y.mean())
_save("global_mean.joblib", global_mean_val)

print("\nAll artifacts saved successfully.")
print(f"Feature count: {len(X_numeric.columns)}")
print(f"Clusters: {kmeans.n_clusters}")
print(f"Global mean logerror: {global_mean_val:.6f}")
