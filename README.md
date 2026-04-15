# Zillow Zestimate Residual Error Prediction

An interactive Next.js showcase site built around a stacked ensemble ML model that predicts **logerror = log(Zestimate) − log(SalePrice)** for 2.9 million Southern California properties.

A positive logerror means Zillow **overestimated** the home value (seller advantage). A negative logerror means it **underestimated** (buyer opportunity). The site surfaces these errors with explainability, plain-English risk advice, and **live multi-cloud integration across 20 AWS and GCP services**.

---

## Pages

| Route | Purpose | Live Services |
|-------|---------|---------------|
| `/` | Main showcase — Hero, Problem Statement, Pipeline, Feature Engineering, County Analysis, Model Comparison, Stacking, SHAP | BigQuery (county chart) |
| `/demo` | Live prediction — full ML output with SHAP bar chart, confidence interval, dollar mispricing | Lambda · Firestore · SNS · SES |
| `/risk-checker` | Consumer risk tool — plain-English risk badge, price gauge, neighbourhood context | Lambda · Firestore · SES |
| `/explainer` | SHAP waterfall + importance chart; "Surprise me" random fill | Firestore (write) |
| `/heatmap` | Leaflet heatmap of 12,500 simulated properties across 25 KMeans spatial clusters | — |
| `/monitoring` | Live prediction counter, real-time Firestore feed, RMSE tracking, feature drift, alert log, drift simulation | Lambda (count) · Firestore · CloudWatch |
| `/pipeline` | Batch scoring architecture — Step Functions diagram, animated progress, CSV download, Cloud Run scorer | CloudFront · Cloud Run |
| `/services` | Index of all 20 cloud services — what each does and which page it appears on | — |

---

## Cloud Architecture — 20 Services

### AWS (10 services · us-east-1)

| Service | What it does | Where on the site |
|---------|-------------|-------------------|
| **Lambda (Prediction)** | Stacked ensemble inference — returns `logerror`, `risk`, confidence interval | `/demo`, `/risk-checker` |
| **Lambda (SES)** | Sends formatted HTML prediction report emails | `/demo`, `/risk-checker` |
| **Lambda (Count)** | Reads running prediction total from DynamoDB | `/monitoring` |
| **DynamoDB** | Stores 500+ historical prediction records; Count Lambda reads from it | `/monitoring` (counter) |
| **S3** | Stores model artifacts: metadata, feature names, cluster centres, pipeline config, CSV | `/pipeline` (diagram reference) |
| **CloudWatch** | Dashboard + 3 alarms (Lambda error rate, duration, DynamoDB throttles) | `/monitoring` (console link) |
| **SNS** | Fires alert to `zillow-price-alerts` topic when `logerror > 0.08` | `/demo` (background) |
| **SQS** | `zillow-prediction-queue` for async batch scoring job messages | `/pipeline` (reference) |
| **CloudFront** | Serves `sample_predictions.csv` via CDN (`d3al9xtnn673r8.cloudfront.net`) | `/pipeline` (download button) |
| **Step Functions** | `ZillowZestimate-MLPipeline` — 5-stage ML orchestration state machine | `/pipeline` (diagram) |
| **SES** | `ZillowPredictionReport` HTML email template | `/demo`, `/risk-checker` |
| **Amplify** | Hosts and continuously deploys the Next.js app | All pages |

### GCP (10 services · us-central1)

| Service | What it does | Where on the site |
|---------|-------------|-------------------|
| **Firestore** | Stores every prediction in real time; live feed via `onSnapshot` | `/demo`, `/risk-checker`, `/explainer`, `/monitoring` |
| **BigQuery** | `zillow_data.county_stats` + `predictions` tables queried on page load | `/` (county chart) |
| **Cloud Run** | `zillow-scorer` container — `/score` and `/health` endpoints | `/pipeline` (Run Scorer button) |
| **Cloud Functions** | `model-health` function — returns live JSON model health status | Backend |
| **Cloud Storage** | `zillow-demo-vajeeda` bucket — model artifacts, CSV, pipeline logs | `/pipeline` (scorer output path) |
| **Cloud Monitoring** | 2 uptime checks (Lambda URL + Cloud Run) + alerting policy | GCP Console |
| **Cloud Logging** | Structured pipeline events (`zillow-batch-pipeline`) + prediction logs | GCP Console |
| **Cloud Scheduler** | `zillow-daily-batch-scorer` (2 AM daily) + weekly health report job | GCP Console |
| **Cloud Build** | `cloudbuild.yaml` — push to main → build → deploy to Cloud Run | CI/CD |
| **Secret Manager** | 10 secrets: Lambda URLs, Firebase key, BQ key, SNS ARN, SQS URL, etc. | GCP Console |

---

## Request Flow

A single prediction on `/demo` triggers this chain:

```
User submits form
      │
      ▼
AWS Lambda (Prediction)
      │
      ├──▶ DynamoDB  (write result)
      ├──▶ GCP Firestore  (write result → live feed on /monitoring updates instantly)
      ├──▶ SNS  (if logerror > 0.08 → alert fires to zillow-price-alerts topic)
      └──▶ CloudWatch  (invocation logged automatically)
            │
            └──▶ (optional) AWS Lambda (SES) → email delivered via SES
```

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

## Engineered Features

All 12 features are computed in `lib/featureEngineering.ts`, mirroring the Python pipeline:

| Feature | Formula | Type |
|---------|---------|------|
| `property_age` | `2016 − yearbuilt` | Temporal |
| `tax_ratio` | `taxamount / (taxvaluedollarcnt + 1)` | Financial |
| `structure_land_ratio` | `structureTax / (landTax + 1)` | Financial |
| `living_area_ratio` | `finishedSqFt / (lotSizeSqFt + 1)` | Spatial |
| `month_sin` | `sin(2π × month / 12)` | Temporal |
| `month_cos` | `cos(2π × month / 12)` | Temporal |
| `geo_cluster` | KMeans k=25 on lat/lon | Spatial |
| `geo_cluster_density` | property count per cluster | Spatial |
| `cluster_mean_tax` | mean tax ratio per cluster | Spatial |
| `geo_cluster_te` | 5-fold CV mean logerror per cluster | Encoded |
| `county_te` | 5-fold CV mean logerror per county | Encoded |
| `age_cluster_interaction` | `property_age × geo_cluster` | Interaction |

Target encoding uses 5-fold cross-validation to prevent data leakage.

---

## County Error Analysis

| County | Mean Logerror | Interpretation |
|--------|--------------|----------------|
| Los Angeles | +0.0142 | Systematically overestimated |
| Orange | −0.0089 | Slightly underestimated on average |
| Ventura | +0.0031 | Near-accurate |

Older homes (60+ years) trend negative (underestimated); newer homes trend positive (overestimated). County chart data is fetched live from BigQuery on every page load, with hardcoded values as an instant fallback so the UI never blocks.

---

## Tech Stack

| Layer | Library / Service |
|-------|-------------------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 (dark theme) |
| Charts | Recharts 2 |
| Maps | Leaflet + react-leaflet + leaflet.heat |
| **Cloud — AWS** | Lambda (×3), DynamoDB, S3, CloudWatch, SNS, SQS, CloudFront, Step Functions, SES, Amplify |
| **Cloud — GCP** | Firestore, BigQuery, Cloud Run, Cloud Functions, Cloud Storage, Cloud Monitoring, Cloud Logging, Cloud Scheduler, Cloud Build, Secret Manager |

---

## Environment Variables

Create `.env.local` at the project root:

```bash
# AWS Lambda function URLs
NEXT_PUBLIC_LAMBDA_URL=https://<prediction-lambda>.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_COUNT_URL=https://<count-lambda>.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_SES_URL=https://<ses-lambda>.lambda-url.us-east-1.on.aws/

# AWS infrastructure
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:<account-id>:zillow-price-alerts
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account-id>/zillow-prediction-queue
CLOUDFRONT_DOMAIN=d3al9xtnn673r8.cloudfront.net

# GCP
NEXT_PUBLIC_CLOUD_RUN_URL=https://<cloud-run-url>.run.app
NEXT_PUBLIC_BQ_KEY=<bigquery-api-key>
NEXT_PUBLIC_GCP_PROJECT=<gcp-project-id>
NEXT_PUBLIC_FIREBASE_API_KEY=<firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
```

All `NEXT_PUBLIC_` variables are exposed to the browser. The non-prefixed variables are server-side only.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm start       # serve production build
```

---

## Seeding Cloud Services

Two scripts populate all 20 services with realistic data:

```bash
# Seed everything
py seed_all.py

# AWS only
py seed_all.py --aws-only

# GCP only
py seed_all.py --gcp-only
```

**Prerequisites:**
```bash
pip install boto3 firebase-admin google-cloud-storage google-cloud-bigquery \
            google-cloud-monitoring google-cloud-logging google-cloud-scheduler \
            google-cloud-secret-manager google-api-python-client

aws configure                          # region: us-east-1
gcloud auth application-default login  # GCP credentials
gcloud config set project cap-expt-492003
```

Place `firebase-service-account.json` next to the scripts for Firestore seeding.

---

## Project Structure

```
zillow_zestimate/
├── app/
│   ├── page.tsx                  # Home — full ML project showcase
│   ├── layout.tsx
│   ├── globals.css
│   ├── demo/page.tsx             # Live prediction — Lambda + Firestore + SNS + SES
│   ├── risk-checker/page.tsx     # Consumer risk tool — Lambda + Firestore + SES
│   ├── explainer/page.tsx        # SHAP waterfall + importance — Firestore write
│   ├── heatmap/page.tsx          # Leaflet geo heatmap (12,500 properties)
│   ├── monitoring/page.tsx       # MLOps dashboard — DynamoDB + Firestore + CloudWatch
│   ├── pipeline/page.tsx         # Batch architecture — CloudFront + Cloud Run + Step Functions
│   └── services/page.tsx         # Index of all 20 cloud services
│
├── components/
│   ├── Navbar.tsx                # Sticky nav with mobile hamburger
│   ├── Hero.tsx                  # Headline + stat cards + cloud status bar
│   ├── Footer.tsx
│   ├── ProblemStatement.tsx
│   ├── Pipeline.tsx              # 12-step ML pipeline card grid
│   ├── DataOverview.tsx          # Dataset stats
│   ├── FeatureEngineeringSection.tsx
│   ├── CountyAnalysis.tsx        # County bar charts — live BigQuery fetch
│   ├── ModelComparison.tsx       # Journey line chart + comparison table
│   ├── StackingSection.tsx       # OOF stacking architecture diagram
│   ├── SHAPSection.tsx           # Pasadena waterfall example
│   ├── GeoHeatmap.tsx            # Leaflet map + heatmap layer
│   ├── HeatmapSidebar.tsx        # Filter controls for heatmap
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
│   ├── mockData.ts               # countyStats, modelJourney, feature data
│   ├── mockGeoData.ts            # 12,500 properties, 25 KMeans clusters
│   └── mockMonitoringData.ts     # RMSE, drift, alert simulation data
│
├── lib/
│   ├── firebase.ts               # Firebase app init + Firestore export
│   ├── featureEngineering.ts     # computeFeatures() — mirrors model.py
│   ├── mockPredictor.ts          # predict() — client-side fallback
│   ├── riskPredictor.ts          # predictRisk() — used by /risk-checker
│   └── shapMock.ts               # computeShap() — client-side SHAP approximation
│
├── seed_all.py                   # Master seeder — runs all 20 services
├── seed_aws_services.py          # Seeds Lambda, S3, CloudWatch, SNS, SQS, Step Functions, SES
├── seed_gcp_services.py          # Seeds Cloud Storage, BigQuery, Cloud Run, Monitoring, etc.
├── seed_dynamodb.py              # Seeds 500 historical prediction records
├── seed_firestore.py             # Seeds 15 recent predictions to Firestore
├── generate_sample_csv.py        # Generates + uploads sample_predictions.csv to S3
├── cloudbuild.yaml               # GCP Cloud Build CI/CD config
├── cloud_function_health/        # Source for the model-health Cloud Function
├── zillow-scorer/                # Source for the Cloud Run batch scorer
├── model.py                      # Main ML training pipeline (Python)
├── feature_engineering.py
├── batch_scorer.py               # Scores 2.9M rows in chunks → Parquet
├── lookup.py                     # Fast parcelid lookup
└── package.json
```

---

## Dataset

- **properties_2016.csv** — ~2.9M rows, raw property features
- **train_2016.csv** — ~90K transactions with logerror labels
- Counties: Los Angeles (FIPS 6037), Orange County (FIPS 6059), Ventura (FIPS 6111)
- Evaluation metric: RMSE on logerror

For the batch scoring pipeline details, see [README_batch.md](README_batch.md).
