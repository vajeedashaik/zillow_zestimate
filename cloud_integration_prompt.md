# Cloud Integration Prompt — Zillow Zestimate Project
## Paste this entire prompt into a fresh Claude Code or Claude chat session

---

You are helping me wire up real cloud services into my existing Next.js Zillow Zestimate website. The website is already built with all 6 applications. I need you to make code changes so that every cloud service is actually doing a real job — not mocked. I will give you all the environment variables and credentials below.

Read the entire prompt before writing any code. Then implement everything in one pass.

---

## CREDENTIALS AND ENVIRONMENT VARIABLES

All of these are already live and working. Use them exactly as written.

```
# AWS
NEXT_PUBLIC_LAMBDA_URL=https://i3xtbsmgemr5fn7x5pj32jptxi0shfby.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_COUNT_URL=https://whogodszx4m5wdpsfpwht4kmei0coctc.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_SES_URL=https://6c6ocnbgd3o7b3slga25wkouza0mcnrq.lambda-url.us-east-1.on.aws/

# GCP
NEXT_PUBLIC_BQ_KEY=AIzaSyAQOF-Xwc8RjXp0B33XVwHr1crfStoW61g
NEXT_PUBLIC_GCP_PROJECT=cap-expt-492003
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA5tHHBiiz8XtW7_Y3aSKFea2VVmxxItAM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zillow-f19c7.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zillow-f19c7
```

Additional AWS values:
```
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:238540685487:zillow-price-alerts
AWS_ACCOUNT_ID=238540685487
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/238540685487/zillow-prediction-queue
CLOUDFRONT_DOMAIN=d3al9xtnn673r8.cloudfront.net
```

Make sure all these values are present in `.env.local`. Create or update `.env.local` with every variable above.

---

## EXISTING PROJECT STRUCTURE

The project is a Next.js 16 App Router project. The key files and pages are:

```
app/
  page.tsx                  — main showcase page
  demo/page.tsx             — live prediction demo (form + result)
  risk-checker/page.tsx     — buyer/seller risk checker
  explainer/page.tsx        — SHAP explainability page
  heatmap/page.tsx          — geo heatmap
  monitoring/page.tsx       — model monitoring dashboard
  pipeline/page.tsx         — batch pipeline page
components/
  Navbar.tsx
  Hero.tsx
  ModelComparison.tsx
  SHAPSection.tsx
  CountyAnalysis.tsx
  (and other existing components)
data/
  mockData.ts
lib/                        — create this folder if it doesn't exist
  featureEngineering.ts
  mockPredictor.ts
  firebase.ts               — create this
```

---

## WHAT TO IMPLEMENT — FULL SPEC

### 1. lib/firebase.ts — Create this file

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const app = getApps().length === 0
  ? initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    })
  : getApps()[0];

export const db = getFirestore(app);
```

Install firebase if not already: `npm install firebase`

---

### 2. app/demo/page.tsx — Prediction form wired to real Lambda

The demo page must have a form with these fields:
- Year Built (number input, default 1985)
- Finished Sq Ft (number input, default 1800)
- Lot Size Sq Ft (number input, default 6500)
- Tax Amount $ (number input, default 8200)
- Tax Value $ (number input, default 620000)
- Transaction Month (select 1–12, default 6)
- County (select: Los Angeles / Orange County / Ventura)
- Zillow Zestimate $ (number input, default 750000) — needed for dollar savings calculation

On submit, do ALL of the following in order:

**Step A — Call Lambda prediction API (AWS)**
```typescript
const res = await fetch(process.env.NEXT_PUBLIC_LAMBDA_URL!, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    yearBuilt: formValues.yearBuilt,
    finishedSqft: formValues.finishedSqft,
    lotSize: formValues.lotSize,
    taxAmount: formValues.taxAmount,
    taxValue: formValues.taxValue,
    month: formValues.month,
    county: formValues.county,
    zestimate: formValues.zestimate,
  })
});
const prediction = await res.json();
// prediction.logerror, prediction.risk, prediction.confidence_low, prediction.confidence_high
```

**Step B — Write to Firestore (GCP) after every prediction**
```typescript
import { db } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';

await addDoc(collection(db, 'predictions'), {
  county: formValues.county,
  risk: prediction.risk,
  logerror: prediction.logerror,
  timestamp: new Date().toISOString(),
  zestimate: formValues.zestimate,
});
```

**Step C — Show result**

Display all of these after prediction:
- Large risk badge: OVERPRICED (red) / FAIR (gray) / UNDERPRICED (green)
- Predicted logerror value
- Confidence interval: low to high
- Dollar impact: `Math.round(Math.abs(prediction.logerror) * formValues.zestimate)` formatted as currency — label it "Estimated mispricing: $X"
- Property age calculated client-side: `2016 - yearBuilt`

**Step D — "Send me this report" email button (AWS SES)**

Below the result, add an email input field and a "Send Report" button:
```typescript
const sendReport = async () => {
  await fetch(process.env.NEXT_PUBLIC_SES_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: emailValue,
      county: formValues.county,
      risk: prediction.risk,
      logerror: prediction.logerror,
      zestimate: formValues.zestimate,
    })
  });
  // Show success message: "Report sent to [email]"
};
```

---

### 3. app/risk-checker/page.tsx — Same form, consumer-friendly output

Same form fields as demo page. On submit:

- Call the same Lambda URL (Step A from above)
- Write to Firestore (Step B from above)
- Show a large styled result card:
  - Prominent risk badge (OVERPRICED / FAIR / UNDERPRICED) with colour
  - "Zillow says $X — our model suggests true value is $Y–$Z"
    - Calculate: `trueValueLow = zestimate / Math.exp(prediction.confidence_high)`
    - Calculate: `trueValueHigh = zestimate / Math.exp(prediction.confidence_low)`
  - "You may have overpaid by $X" or "You may be getting a deal of $X"
  - Top 3 feature contributions (use these mock values keyed off the prediction):
    - tax_ratio contribution: `(taxAmount / (taxValue + 1)) * 1.82`
    - county contribution: `{ 'Los Angeles': 0.0142, 'Orange County': -0.0089, 'Ventura': 0.0031 }[county] * 0.8`
    - property_age contribution: `-(2016 - yearBuilt) * 0.00015`
  - Buyer advice (if OVERPRICED): "Consider negotiating below the Zestimate. Properties in this area are overestimated 61% of the time."
  - Seller advice (if UNDERPRICED): "The Zestimate may be in your favour. Consider listing at or above it."
- Add "Email this report" button same as demo page (calls SES URL)

---

### 4. app/explainer/page.tsx — SHAP explainer calling GCP Cloud Functions

If you have a Cloud Functions URL available (NEXT_PUBLIC_CLOUD_FUNC_URL), call it. If not, compute SHAP values client-side using this logic and display the results. Either way the page must show a real waterfall chart.

Client-side SHAP computation (use this if no Cloud Functions URL):
```typescript
const computeShap = (inputs: FormInputs) => {
  const tr = inputs.taxAmount / (inputs.taxValue + 1);
  const age = 2016 - inputs.yearBuilt;
  const lar = inputs.finishedSqft / (inputs.lotSize + 1);
  const cte = { 'Los Angeles': 0.0142, 'Orange County': -0.0089, 'Ventura': 0.0031 }[inputs.county] ?? 0;
  const gte = tr > 0.02 ? 0.024 : tr > 0.01 ? 0.012 : -0.008;
  
  return [
    { feature: 'tax_ratio', value: parseFloat(tr.toFixed(4)), shap: parseFloat((tr * 1.82).toFixed(4)), direction: tr > 0.013 ? 'up' : 'down', description: 'Tax burden relative to property value' },
    { feature: 'geo_cluster_te', value: parseFloat(gte.toFixed(4)), shap: parseFloat((gte * 0.6).toFixed(4)), direction: gte > 0 ? 'up' : 'down', description: 'Historical error in this spatial cluster' },
    { feature: 'county_te', value: parseFloat(cte.toFixed(4)), shap: parseFloat((cte * 0.8).toFixed(4)), direction: cte > 0 ? 'up' : 'down', description: 'County-level Zestimate bias' },
    { feature: 'property_age', value: age, shap: parseFloat((-age * 0.00015).toFixed(4)), direction: 'down', description: 'Age of the property in years' },
    { feature: 'living_area_ratio', value: parseFloat(lar.toFixed(4)), shap: parseFloat((lar * 0.003).toFixed(4)), direction: 'up', description: 'Living area as fraction of lot size' },
  ].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));
};
```

Display as a horizontal Recharts BarChart waterfall — red bars (positive shap = increases error), blue bars (negative shap = decreases error). Base value: 0.045.

Add a "Surprise me" button that fills the form with random realistic values.

Also write to Firestore after generating SHAP values (same pattern as demo page).

---

### 5. app/monitoring/page.tsx — Live data from DynamoDB + Firestore

This page must show REAL live data, not mocked numbers.

**Live prediction counter from DynamoDB (AWS):**
```typescript
const [count, setCount] = useState<number>(0);
useEffect(() => {
  fetch(process.env.NEXT_PUBLIC_COUNT_URL!)
    .then(r => r.json())
    .then(d => setCount(d.total))
    .catch(() => setCount(0));
}, []);
```
Display as a large metric card: "Total predictions served" with the live number.

**Real-time Firestore feed (GCP):**
```typescript
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

const [feed, setFeed] = useState<any[]>([]);
useEffect(() => {
  const q = query(
    collection(db, 'predictions'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  const unsub = onSnapshot(q, snap => {
    setFeed(snap.docs.map(d => d.data()));
  });
  return () => unsub();
}, []);
```
Display as a live activity feed showing the last 10 predictions with county, risk badge, and logerror. Label it "Live prediction feed — updates in real time from GCP Firestore".

**CloudWatch link:**
Add a card with a direct link to the CloudWatch dashboard:
```tsx
<a href="https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:" target="_blank">
  View live AWS CloudWatch metrics →
</a>
```

**Static metric cards (use realistic hardcoded values for these):**
- Current CV RMSE: 0.0742
- Model status: HEALTHY (green badge)
- AWS API uptime: 99.8%
- GCP Cloud Run status: ACTIVE (green badge)

---

### 6. app/pipeline/page.tsx — S3/CloudFront download + Cloud Run button

**Real download button using CloudFront (AWS):**
```tsx
<a
  href="https://d3al9xtnn673r8.cloudfront.net/sample_predictions.csv"
  download="sample_predictions.csv"
  className="download-btn"
>
  Download sample output (CSV) — served via AWS CloudFront CDN
</a>
```
If the CloudFront URL doesn't work, fall back to S3 directly (check if you have an S3 bucket URL in the project, otherwise use CloudFront only).

**Run Scorer button calling GCP Cloud Run:**
If you have a NEXT_PUBLIC_CLOUD_RUN_URL in .env, call it. If not, simulate the response client-side with a loading state:
```typescript
const runScorer = async () => {
  setLoading(true);
  setResult(null);
  
  try {
    const url = process.env.NEXT_PUBLIC_CLOUD_RUN_URL;
    if (url) {
      const res = await fetch(url + '/score', { method: 'POST', body: '{}' });
      const data = await res.json();
      setResult(data);
    } else {
      // Simulate if no Cloud Run URL
      await new Promise(r => setTimeout(r, 1500));
      setResult({
        status: 'complete',
        rows_processed: 2900000,
        time_seconds: 694.3,
        output: 'gs://zillow-zestimate-demo/sample_predictions.csv',
        rmse: 0.0742,
      });
    }
  } finally {
    setLoading(false);
  }
};
```

Show result as: status badge, rows processed (formatted with commas), time taken, output location, final RMSE.

**AWS Step Functions visual pipeline:**
Add a static section showing the pipeline steps as a visual flow (styled divs or SVG, not an image):
Steps: Load Data (2.9M rows from S3) → Feature Engineering (11 features) → Run Ensemble (XGB + LGBM + CatBoost + Ridge) → Save Results (DynamoDB + S3) → Send Alerts (SNS)
Label it "AWS Step Functions ML Pipeline Orchestration".

---

### 7. components/CountyAnalysis.tsx — BigQuery live SQL query (GCP)

Replace any hardcoded county data with a live BigQuery fetch:

```typescript
const [countyData, setCountyData] = useState([
  // Fallback data if BigQuery fails
  { county: 'Los Angeles', mean_logerror: 0.0142, pct_overpriced: 61.3, total_properties: 847921 },
  { county: 'Orange County', mean_logerror: -0.0089, pct_overpriced: 44.2, total_properties: 423156 },
  { county: 'Ventura', mean_logerror: 0.0031, pct_overpriced: 52.1, total_properties: 198043 },
]);

useEffect(() => {
  const PROJECT = process.env.NEXT_PUBLIC_GCP_PROJECT;
  const KEY = process.env.NEXT_PUBLIC_BQ_KEY;
  
  if (!PROJECT || !KEY) return;
  
  fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/queries?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT county, mean_logerror, pct_overpriced, total_properties FROM \`${PROJECT}.zillow_data.county_stats\` ORDER BY mean_logerror DESC`,
        useLegacySql: false,
        timeoutMs: 10000,
      })
    }
  )
  .then(r => r.json())
  .then(data => {
    if (data.rows) {
      setCountyData(data.rows.map((r: any) => ({
        county: r.f[0].v,
        mean_logerror: parseFloat(r.f[1].v),
        pct_overpriced: parseFloat(r.f[2].v),
        total_properties: parseInt(r.f[3].v),
      })));
    }
    // If rows is empty or query fails, keep fallback data silently
  })
  .catch(() => {
    // Keep fallback data — never break the UI
  });
}, []);
```

Important: always show the fallback data first, then update with live data if it arrives. Never show a loading spinner that blocks the chart from rendering.

---

### 8. Add "Cloud Services Live" indicator to Navbar or Hero

Add a small status row somewhere visible (hero section or just below the navbar) showing which cloud services are live:

```tsx
<div className="cloud-status-bar">
  <span className="status-dot green" /> AWS Lambda
  <span className="status-dot green" /> DynamoDB
  <span className="status-dot green" /> SNS Alerts
  <span className="status-dot green" /> GCP Firestore
  <span className="status-dot green" /> BigQuery
  <span className="status-dot green" /> CloudFront CDN
</div>
```
Style as small green dots with service names. This is visible proof of multi-cloud integration.

---

## IMPORTANT RULES

1. **Never break the UI** — every cloud call must have a try/catch. If a service fails, show fallback data silently. The site must always render.

2. **Never block on loading** — use optimistic rendering. Show mock/fallback data immediately, then replace it with real data when the fetch resolves.

3. **All environment variables are already set** — do not create placeholder values. Use the exact variables from the .env.local block at the top of this prompt.

4. **Keep existing styles** — the site has a dark theme. All new UI elements must match the existing Tailwind dark theme classes already used in the project.

5. **Do not remove any existing functionality** — only add to it. If a page already has a chart or component, keep it and add the cloud integration around it.

6. **Install missing packages** — if firebase is not installed, run `npm install firebase`. If any other package is missing, install it.

7. **SQS note** — the SQS queue URL is provided but wiring the full SQS producer Lambda is complex. Instead, add a comment in the demo page code: `// SQS queue available at: https://sqs.us-east-1.amazonaws.com/238540685487/zillow-prediction-queue` and mention it in the pipeline page as part of the architecture description.

8. **SNS note** — SNS is triggered by the Lambda function server-side (not from Next.js directly). Add a note on the demo page: "An SNS alert is automatically fired to our monitoring system when logerror > 0.08" — this will fire automatically since the Lambda is already configured with the SNS ARN.

---

## OUTPUT CHECKLIST

After making all changes, confirm:
- [ ] `.env.local` has all variables
- [ ] `lib/firebase.ts` created
- [ ] `npm install firebase` run
- [ ] `app/demo/page.tsx` — calls Lambda, writes to Firestore, shows SES email button
- [ ] `app/risk-checker/page.tsx` — calls Lambda, writes to Firestore, shows dollar impact, shows SES button
- [ ] `app/explainer/page.tsx` — computes SHAP values (client-side or Cloud Functions), shows waterfall chart
- [ ] `app/monitoring/page.tsx` — live DynamoDB counter, live Firestore feed, CloudWatch link
- [ ] `app/pipeline/page.tsx` — CloudFront download button, Run Scorer button, Step Functions diagram
- [ ] `components/CountyAnalysis.tsx` — BigQuery fetch with fallback
- [ ] Cloud status indicator added to hero or navbar
- [ ] No TypeScript errors
- [ ] `npm run build` passes
