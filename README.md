# Zillow Zestimate Residual Error Prediction

An interactive Next.js showcase site for a student project expo, built around a stacked ensemble ML model that predicts **logerror = log(Zestimate) − log(SalePrice)** for 2.9 million Southern California properties.

A positive logerror means Zillow **overestimated** the home value (seller advantage). A negative logerror means it **underestimated** (buyer opportunity). The site surfaces these errors with explainability, plain-English risk advice, and **live multi-cloud integration** (AWS + GCP).

---

## Live Pages

| Route | Description |
|-------|-------------|
| `/` | Main showcase — Hero, Problem Statement, Pipeline, Feature Engineering, County Analysis, Model Comparison, Stacking, SHAP |
| `/demo` | **Live Prediction Demo** — calls real AWS Lambda, writes to GCP Firestore, shows logerror + dollar mispricing + SES email report |
| `/risk-checker` | Consumer risk tool — Lambda-powered risk badge, price range, neighbourhood context, SES report button |
| `/explainer` | SHAP waterfall + importance chart; "Surprise me" random fill; every result written to Firestore |
| `/heatmap` | Leaflet heatmap of 12,500 simulated properties across 25 KMeans spatial clusters |
| `/monitoring` | Live DynamoDB prediction counter, real-time Firestore activity feed, CloudWatch link, RMSE tracking, feature drift, alert log |
| `/pipeline` | CloudFront CSV download, GCP Cloud Run scorer button, AWS Step Functions diagram, animated batch progress |

---

## Cloud Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Services                            │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │ Lambda      │   │ Lambda      │   │ Lambda              │   │
│  │ (Prediction)│   │ (SES Email) │   │ (Count / DynamoDB)  │   │
│  └──────┬──────┘   └─────────────┘   └─────────────────────┘   │
│         │                                                       │
│  ┌──────▼──────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │ SNS         │   │ SQS Queue   │   │ CloudFront CDN      │   │
│  │ (Alerts)    │   │ (Async jobs)│   │ (CSV downloads)     │   │
│  └─────────────┘   └─────────────┘   └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         GCP Services                            │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │ Firestore   │   │ BigQuery    │   │ Cloud Run           │   │
│  │ (Live feed) │   │ (County     │   │ (Batch scorer)      │   │
│  │             │   │  stats)     │   │                     │   │
│  └─────────────┘   └─────────────┘   └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### AWS Services

| Service | Role |
|---------|------|
| **Lambda (Prediction)** | Runs the stacked ensemble inference — returns `logerror`, `risk`, and confidence interval |
| **Lambda (SES)** | Sends prediction report emails via Amazon SES |
| **Lambda (Count)** | Reads the running prediction counter from DynamoDB |
| **SNS** | Automatically fires an alert when `logerror > 0.08` (wired in the prediction Lambda) |
| **SQS** | Queue for async prediction jobs (`zillow-prediction-queue`) |
| **CloudFront** | Serves the sample output CSV via CDN (`d3al9xtnn673r8.cloudfront.net`) |

### GCP Services

| Service | Role |
|---------|------|
| **Firestore** | Stores every prediction in real time; `/monitoring` subscribes with `onSnapshot` |
| **BigQuery** | Serves county-level aggregate stats (`zillow_data.county_stats`) for the county chart |
| **Cloud Run** | Hosts the batch scorer; triggered from the `/pipeline` page |

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

| Layer | Library / Service |
|-------|-------------------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 (dark theme) |
| Charts | Recharts 2 |
| Maps | Leaflet + react-leaflet + leaflet.heat |
| Icons | lucide-react |
| **Cloud — AWS** | Lambda (3 functions), SNS, SQS, SES, CloudFront, DynamoDB |
| **Cloud — GCP** | Firestore, BigQuery, Cloud Run |

---

## Environment Variables

Create `.env.local` at the project root with the following:

```bash
# AWS Lambda function URLs
NEXT_PUBLIC_LAMBDA_URL=https://<prediction-lambda>.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_COUNT_URL=https://<count-lambda>.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_SES_URL=https://<ses-lambda>.lambda-url.us-east-1.on.aws/

# AWS infrastructure
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:<account-id>:zillow-price-alerts
AWS_ACCOUNT_ID=<account-id>
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account-id>/zillow-prediction-queue
CLOUDFRONT_DOMAIN=<distribution-id>.cloudfront.net

# GCP
NEXT_PUBLIC_BQ_KEY=<bigquery-api-key>
NEXT_PUBLIC_GCP_PROJECT=<gcp-project-id>
NEXT_PUBLIC_FIREBASE_API_KEY=<firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
```

All `NEXT_PUBLIC_` variables are exposed to the browser. The non-prefixed variables (`SNS_TOPIC_ARN`, `SQS_QUEUE_URL`, etc.) are server-side only and used for documentation / future API routes.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To build for production:

```bash
npm run build
npm start
```

---

## Project Structure

```
zillow_zestimate/
├── app/
│   ├── page.tsx                  # Main showcase page
│   ├── layout.tsx
│   ├── globals.css
│   ├── demo/page.tsx             # Live prediction — Lambda + Firestore + SES
│   ├── heatmap/page.tsx          # Geo heatmap (Leaflet)
│   ├── risk-checker/page.tsx     # Consumer risk checker — Lambda + Firestore + SES
│   ├── explainer/page.tsx        # SHAP explainer — Firestore write on every result
│   ├── monitoring/page.tsx       # Live DynamoDB counter + Firestore feed + CloudWatch
│   └── pipeline/page.tsx         # CloudFront download + Cloud Run scorer + Step Functions
│
├── components/
│   ├── Navbar.tsx                # Sticky nav with hamburger on mobile
│   ├── Hero.tsx                  # Headline + stat cards + cloud status bar
│   ├── Footer.tsx
│   ├── ProblemStatement.tsx
│   ├── Pipeline.tsx              # 12-step ML pipeline card grid
│   ├── DataOverview.tsx          # Dataset stats
│   ├── FeatureEngineeringSection.tsx  # 12 engineered features
│   ├── CountyAnalysis.tsx        # County + age bar charts — live BigQuery fetch
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
│   ├── mockData.ts               # countyStats, ageGroupStats, modelJourney, etc.
│   ├── mockGeoData.ts            # 12,500 properties, 25 KMeans clusters
│   └── mockMonitoringData.ts     # RMSE, drift, alert simulation data
│
├── lib/
│   ├── firebase.ts               # Firebase app init + Firestore export
│   ├── featureEngineering.ts     # computeFeatures() — mirrors model.py
│   ├── mockPredictor.ts          # predict() — client-side fallback
│   ├── riskPredictor.ts          # predictRisk() — used by risk-checker
│   └── shapMock.ts               # computeShap() — client-side SHAP approximation
│
├── types/
│   ├── leaflet.heat.d.ts         # Leaflet module augmentation
│   └── leaflet-heat-module.d.ts  # Ambient module declaration for leaflet.heat
│
├── model.py                      # Main ML pipeline (Python)
├── feature_engineering.py
├── batch_scorer.py               # Scores 2.9M rows in chunks → Parquet
├── lookup.py                     # Fast parcelid lookup
├── benchmark.py
├── save_models.py
├── README_batch.md               # Batch scoring pipeline docs
└── package.json
```

---

## Cloud Integration Details

### Prediction flow (`/demo`, `/risk-checker`)

1. Form submitted → **POST to AWS Lambda** with property features
2. Lambda returns `{ logerror, risk, confidence_low, confidence_high }`
3. Result displayed: risk badge, dollar mispricing estimate, confidence interval, SHAP contributions (computed client-side)
4. **Write to GCP Firestore** `predictions` collection
5. Optional: **POST to AWS SES Lambda** to email the report
6. If Lambda is unreachable → client-side fallback formula runs silently; UI never breaks

### SNS alerts

The prediction Lambda is pre-configured with `SNS_TOPIC_ARN`. It automatically publishes to the `zillow-price-alerts` topic whenever `logerror > 0.08`, triggering downstream monitoring alerts. No additional code needed in the frontend.

### Monitoring page (`/monitoring`)

- **DynamoDB counter**: `GET NEXT_PUBLIC_COUNT_URL` → `{ total: number }` — shown as "Total predictions served"
- **Firestore live feed**: `onSnapshot` on `predictions` collection (ordered by timestamp desc, limit 10) — updates in real time as new predictions arrive from any page
- **CloudWatch link**: direct link to the AWS CloudWatch dashboard for Lambda/SES metrics

### County Analysis (`/`)

`CountyAnalysis.tsx` fetches from the BigQuery REST API on mount:

```sql
SELECT county, mean_logerror, pct_overpriced, total_properties
FROM `<project>.zillow_data.county_stats`
ORDER BY mean_logerror DESC
```

The chart renders immediately from hardcoded fallback data, then silently updates if BigQuery responds. The UI never blocks on this fetch.

### Pipeline page (`/pipeline`)

- **CloudFront download**: `https://d3al9xtnn673r8.cloudfront.net/sample_predictions.csv`
- **Run Scorer**: calls `NEXT_PUBLIC_CLOUD_RUN_URL/score` if set; otherwise simulates a 1.5s run and returns mock results
- **Step Functions diagram**: static visual of the 5-step AWS orchestration flow (Load Data → Feature Engineering → Run Ensemble → Save Results → Send Alerts)

---

## Engineered Features

All 12 features are computed in `lib/featureEngineering.ts`, mirroring the Python pipeline:

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

Older homes (60+ years) trend negative (underestimated); newer homes trend positive (overestimated). County chart data is fetched live from BigQuery on every page load, with mock values as instant fallback.
