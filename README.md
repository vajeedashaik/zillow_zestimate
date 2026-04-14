# Zillow Zestimate Residual Error Prediction

An interactive Next.js showcase site for a student project expo, built around a stacked ensemble ML model that predicts **logerror = log(Zestimate) − log(SalePrice)** for 2.9 million Southern California properties.

A positive logerror means Zillow **overestimated** the home value (seller advantage). A negative logerror means it **underestimated** (buyer opportunity). The goal is to surface these errors with explainability and plain-English risk advice.

---

## Live Pages

| Route | Description |
|-------|-------------|
| `/` | Main showcase — Hero, Problem Statement, Pipeline, Feature Engineering, County Analysis, Model Comparison, Stacking, SHAP |
| `/demo` | **Live Prediction Demo** — input any property, get logerror prediction, true value range, SHAP contributions, buyer/seller advice |
| `/risk-checker` | Consumer-facing risk tool — large risk badge, gauge, price range card, neighbourhood context |
| `/explainer` | SHAP waterfall + importance chart for any property; "Surprise me" random fill |
| `/heatmap` | Leaflet heatmap of 12,500 simulated properties across 25 KMeans spatial clusters |
| `/monitoring` | Production monitoring dashboard — RMSE tracking, feature drift, alert log, drift simulation |
| `/pipeline` | Visual batch scoring pipeline — animated progress bar, output schema, sample CSV download |

---

## Model Results (5-fold CV RMSE)

| Model | CV RMSE |
|-------|---------|
| Ridge (baseline) | 0.0791 |
| ExtraTrees | 0.0763 |
| XGBoost | 0.0754 |
| CatBoost | 0.0751 |
| LightGBM (Bayesian-tuned) | 0.0749 |
| **Ensemble Stack** | **0.0742** ← best (−6.2% vs baseline) |

The ensemble uses **out-of-fold stacking**: XGBoost + LightGBM + CatBoost produce OOF predictions → Ridge meta-model combines them. No data leakage.

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 (dark theme) |
| Charts | Recharts 2 |
| Maps | Leaflet + react-leaflet + leaflet.heat |
| Icons | lucide-react |

---

## Project Structure

```
zillow_zestimate/
├── app/
│   ├── page.tsx                  # Main showcase page
│   ├── layout.tsx
│   ├── globals.css
│   ├── demo/page.tsx             # Live prediction demo
│   ├── heatmap/page.tsx          # Geo heatmap
│   ├── risk-checker/page.tsx     # Buyer/seller risk checker
│   ├── explainer/page.tsx        # SHAP explainer
│   ├── monitoring/page.tsx       # Model monitoring dashboard
│   └── pipeline/page.tsx         # Batch scoring visual
│
├── components/
│   ├── Navbar.tsx                # Sticky nav with hamburger on mobile
│   ├── Hero.tsx                  # Headline + 5 stat cards
│   ├── Footer.tsx
│   ├── ProblemStatement.tsx
│   ├── Pipeline.tsx              # 12-step ML pipeline card grid
│   ├── DataOverview.tsx          # Dataset stats
│   ├── FeatureEngineeringSection.tsx  # 12 engineered features
│   ├── CountyAnalysis.tsx        # County + age bucket bar charts
│   ├── ModelComparison.tsx       # Journey line chart + comparison table
│   ├── StackingSection.tsx       # OOF stacking architecture diagram
│   ├── SHAPSection.tsx           # Pasadena waterfall example
│   ├── GeoHeatmap.tsx            # Leaflet map with heatmap layer
│   ├── HeatmapSidebar.tsx        # Filter controls
│   ├── RiskBadge.tsx
│   ├── PredictionGauge.tsx
│   ├── PriceRangeCard.tsx
│   ├── NeighbourhoodContext.tsx
│   ├── WaterfallChart.tsx
│   ├── ShapBarChart.tsx
│   └── monitoring/
│       ├── RmseChart.tsx
│       ├── FeatureDriftPanel.tsx
│       └── AlertLog.tsx
│
├── data/
│   ├── mockData.ts               # countyStats, ageGroupStats, modelJourney,
│   │                             #   waterfallData, modelResults, engineeredFeatures,
│   │                             #   pipelineSteps, monitoringData, alertLog
│   ├── mockGeoData.ts            # 12,500 properties, 25 KMeans clusters
│   └── mockMonitoringData.ts     # RMSE, drift, alert simulation
│
├── lib/
│   ├── featureEngineering.ts     # computeFeatures() — mirrors model.py
│   ├── mockPredictor.ts          # predict() — logerror formula + seeded noise
│   ├── riskPredictor.ts          # predictRisk() — used by risk-checker
│   └── shapMock.ts               # computeShap() — client-side SHAP approximation
│
├── model.py                      # Main ML pipeline (Python)
├── feature_engineering.py
├── batch_scorer.py               # Scores all 2.9M rows in chunks → Parquet
├── lookup.py                     # Fast parcelid lookup
├── benchmark.py
├── save_models.py
├── README_batch.md               # Batch scoring pipeline docs
└── package.json
```

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Engineered Features

All 12 features are computed client-side in `lib/featureEngineering.ts`, mirroring the Python pipeline:

| Feature | Formula | Type |
|---------|---------|------|
| `property_age` | `2016 − yearbuilt` | Temporal |
| `tax_ratio` | `taxamount / (taxvaluedollarcnt + 1)` | Financial |
| `structure_land_ratio` | `structureTax / (landTax + 1)` | Financial |
| `living_area_ratio` | `finishedSqFt / (lotSizeSqFt + 1)` | Financial |
| `month_sin` | `sin(2π × month / 12)` | Temporal |
| `month_cos` | `cos(2π × month / 12)` | Temporal |
| `geo_cluster` | KMeans k=25 on lat/lon | Spatial |
| `geo_cluster_density` | property count per cluster | Spatial |
| `cluster_mean_tax` | mean tax per cluster | Spatial |
| `geo_cluster_te` | 5-fold CV mean logerror per cluster | Spatial |
| `county_te` | 5-fold CV mean logerror per county | Spatial |
| `age_cluster_interaction` | `property_age × geo_cluster` | Interaction |

Target encoding uses 5-fold cross-validation to prevent data leakage.

---

## Dataset

- **properties_2016.csv** — ~2.9M rows, raw property features
- **train_2016.csv** — ~90K transactions with logerror labels
- Counties: Los Angeles (FIPS 6037), Orange (FIPS 6059), Ventura (FIPS 6111)
- Evaluation metric: RMSE on logerror

For the batch scoring pipeline, see [README_batch.md](README_batch.md).

---

## County Error Analysis

| County | Mean Logerror | Interpretation |
|--------|--------------|----------------|
| Los Angeles | +0.0142 | Systematically overestimated |
| Orange | −0.0089 | Slightly underestimated on average |
| Ventura | +0.0031 | Near-accurate |

Older homes (60+ years) trend negative (underestimated); newer homes trend positive (overestimated).
