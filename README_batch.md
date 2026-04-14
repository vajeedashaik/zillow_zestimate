# Zillow Zestimate — Batch Scoring Pipeline

End-to-end pipeline that scores all **2.9 million** properties in
`properties_2016.csv` with the stacked XGBoost + LightGBM + CatBoost + Ridge
ensemble and stores results in partitioned Parquet files for fast lookups.

---

## Files

| File | Purpose |
|------|---------|
| `batch_scorer.py` | Main pipeline — chunked CSV read → feature engineering → predict → Parquet write |
| `lookup.py` | In-memory lookup module (`load_predictions`, `get_cluster_stats`) |
| `benchmark.py` | Timing script for the full run and lookup latency |
| `requirements_batch.txt` | Python dependencies for batch components |

These files extend the existing project (`model_loader.py`, `feature_engineering.py`,
`save_models.py`) without modifying them.

---

## Prerequisites

### 1. Trained model artifacts

Run `save_models.py` once **in the same Python session as `model.py`** (or in Colab)
to serialise all artifacts into `./models/`:

```
models/
  geo_scaler.joblib
  kmeans.joblib
  xgb_model.joblib
  lgb_model.joblib
  cat_model.joblib
  meta_model.joblib
  feature_columns.joblib
  geo_cluster_means.joblib
  county_means.joblib
  cluster_density.joblib
  cluster_agg.joblib
  train_medians.joblib
  global_mean.joblib
```

### 2. Install dependencies

```bash
pip install -r requirements_batch.txt
```

### 3. Dataset

Place `properties_2016.csv` in the project root (or pass `--input` to override).

---

## How to Run

### Full batch scoring (all 2.9M rows)

```bash
python batch_scorer.py
```

With options:

```bash
python batch_scorer.py \
    --input      properties_2016.csv \
    --output-dir predictions \
    --chunk-size 50000 \
    --models-dir models
```

**Output** in `predictions/`:

```
predictions/
  fips_6037.parquet   ← Los Angeles County
  fips_6059.parquet   ← Orange County
  fips_6111.parquet   ← Ventura County
  run_metadata.json   ← timing + row counts
```

A `batch_scorer.log` is also written to the project root.

---

## Output Schema

Each Parquet file contains one row per property:

| Column | Type | Description |
|--------|------|-------------|
| `parcelid` | int32 | Zillow property identifier |
| `fips` | int16 | County FIPS code (6037 / 6059 / 6111) |
| `geo_cluster` | int8 | Spatial cluster (0 – 24) |
| `predicted_logerror` | float32 | Ensemble prediction: log(Zestimate) − log(SalePrice) |
| `percentile_rank` | float32 | Fractional rank among all 2.9M properties (0 = lowest, 1 = highest predicted error) |

---

## Lookup API

```python
from lookup import load_predictions, get_cluster_stats

# Single property lookup
result = load_predictions(14538543)
# {
#   'parcelid': 14538543,
#   'fips': 6037,
#   'geo_cluster': 11,
#   'predicted_logerror': -0.0132,
#   'percentile_rank': 0.4213
# }

# Cluster aggregate stats
stats = get_cluster_stats(11)
# {
#   'cluster_id': 11,
#   'mean': -0.0051,
#   'std': 0.0843,
#   'count': 116234
# }
```

If the prediction directory is not `./predictions/`, call
`set_predictions_dir("path/to/dir")` before any lookup.

### Error handling

| Scenario | Behaviour |
|----------|-----------|
| `parcelid` not in dataset | raises `KeyError` with a descriptive message |
| `parcelid` is not an integer | raises `TypeError` |
| `cluster_id` out of range | raises `KeyError` with valid range in message |
| Parquet files missing | raises `FileNotFoundError` pointing to batch_scorer |

---

## Benchmark

```bash
# Score full dataset and benchmark lookups
python benchmark.py

# Scoring only (different chunk sizes)
python benchmark.py --mode full --chunk-sizes 25000,50000,100000

# Lookup latency only (predictions must already exist)
python benchmark.py --mode lookup --single-lookups 5000
```

Results are printed to console and saved to `benchmark_results.json`.

---

## Expected Runtime

Estimates on a modern laptop (8-core CPU, 16 GB RAM, SSD):

| Stage | Time |
|-------|------|
| Artifact load | ~5 s |
| Scoring 2.9M rows (chunk=50 000) | 8 – 18 min |
| Parquet write | ~15 s |
| Lookup cold load | ~3 – 6 s |
| Single-parcel lookup (warm) | < 0.1 ms |
| Batch lookup (n=10 000) | < 50 ms |

Peak RAM during scoring: **~2.5 – 3.5 GB** (dominated by model objects, not the chunk).

---

## Memory Notes

- The pipeline processes 50 000 rows at a time; peak per-chunk DataFrame is
  ~100–200 MB.
- Model objects (XGBoost/LightGBM/CatBoost) are loaded once and stay resident.
- If you hit OOM, reduce `--chunk-size` to 10 000–25 000.
- The lookup module loads ~120 MB of Parquet into RAM for O(1) dict lookups.

---

## Logging

`batch_scorer.py` writes structured logs to both stdout and `batch_scorer.log`:

```
2025-09-01 12:00:01 [INFO] Zillow Batch Scoring Pipeline
2025-09-01 12:00:06 [INFO] Artifacts loaded. Feature count: 42  |  RAM: 812.3 MiB
2025-09-01 12:00:08 [INFO] Total rows: 2985217  |  Estimated chunks: 60
...
2025-09-01 12:14:22 [INFO] Total scored: 2983891  |  Skipped: 1326  |  Wall: 855s
```

Per-chunk timing, RAM, and row counts are visible in the `tqdm` progress bar
postfix in real time.
