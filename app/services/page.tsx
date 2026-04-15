import Link from 'next/link';
import Navbar from '@/components/Navbar';

// ─── Data ────────────────────────────────────────────────────────────────────

const AWS_SERVICES = [
  {
    name: 'AWS Lambda',
    badge: 'Compute',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-400',
    what: 'Three serverless functions power real-time predictions, email delivery, and the live DynamoDB counter.',
    where: [
      { label: '/demo', href: '/demo', note: 'POST → prediction Lambda → returns logerror + risk' },
      { label: '/risk-checker', href: '/risk-checker', note: 'Same prediction Lambda, alternate UI' },
      { label: '/monitoring', href: '/monitoring', note: 'GET → count Lambda → reads DynamoDB total' },
    ],
  },
  {
    name: 'AWS DynamoDB',
    badge: 'Database',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotColor: 'bg-blue-400',
    what: '500+ historical prediction records stored as a time-series. The prediction Lambda writes every scored property here.',
    where: [
      { label: '/monitoring', href: '/monitoring', note: '"Total predictions served" counter — live DynamoDB scan via Lambda' },
    ],
  },
  {
    name: 'AWS S3',
    badge: 'Storage',
    badgeColor: 'bg-green-500/15 text-green-400 border-green-500/30',
    dotColor: 'bg-green-400',
    what: 'Stores model artifacts (metadata, feature names, cluster centres, pipeline config) and the sample predictions CSV.',
    where: [
      { label: '/pipeline', href: '/pipeline', note: 'Step Functions diagram — "Load Data: 2.9M rows from S3"' },
    ],
  },
  {
    name: 'AWS CloudWatch',
    badge: 'Observability',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    dotColor: 'bg-purple-400',
    what: 'Dashboard "ZillowZestimate-ML-Pipeline" with 3 alarms: Lambda error rate, Lambda duration, and DynamoDB throttles.',
    where: [
      { label: '/monitoring', href: '/monitoring', note: '"View live AWS CloudWatch metrics →" button links to the console dashboard' },
    ],
  },
  {
    name: 'AWS SNS',
    badge: 'Messaging',
    badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    dotColor: 'bg-rose-400',
    what: 'Publishes an alert to the zillow-price-alerts topic whenever a prediction logerror exceeds the 0.08 threshold.',
    where: [
      { label: '/demo', href: '/demo', note: 'Auto-fires in the background on high-logerror predictions (> 0.08)' },
    ],
  },
  {
    name: 'AWS SQS',
    badge: 'Queue',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    dotColor: 'bg-cyan-400',
    what: 'zillow-prediction-queue holds async batch scoring job messages. Decouples job submission from execution.',
    where: [
      { label: '/pipeline', href: '/pipeline', note: 'Queue URL shown in pipeline infrastructure notes' },
    ],
  },
  {
    name: 'AWS CloudFront',
    badge: 'CDN',
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dotColor: 'bg-orange-400',
    what: 'Serves sample_predictions.csv from 200+ edge locations via the distribution d3al9xtnn673r8.cloudfront.net.',
    where: [
      { label: '/pipeline', href: '/pipeline', note: '"Download sample output (CSV) — AWS CloudFront CDN" button' },
    ],
  },
  {
    name: 'AWS Step Functions',
    badge: 'Orchestration',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    dotColor: 'bg-indigo-400',
    what: 'State machine ZillowZestimate-MLPipeline orchestrates the 5-stage ML workflow: Load → Features → Ensemble → Save → Alerts.',
    where: [
      { label: '/pipeline', href: '/pipeline', note: 'Visual 5-step orchestration diagram with step labels and details' },
    ],
  },
  {
    name: 'AWS SES',
    badge: 'Email',
    badgeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    dotColor: 'bg-pink-400',
    what: 'Sends a formatted HTML prediction report email using the ZillowPredictionReport template.',
    where: [
      { label: '/demo', href: '/demo', note: '"Send Report" button — enter email → SES Lambda delivers the report' },
      { label: '/risk-checker', href: '/risk-checker', note: 'Same "Send Report" flow' },
    ],
  },
  {
    name: 'AWS Amplify',
    badge: 'Hosting',
    badgeColor: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    dotColor: 'bg-teal-400',
    what: 'Hosts and continuously deploys the Next.js app. Push to main → Amplify rebuilds and serves the updated site.',
    where: [
      { label: 'All pages', href: '/', note: 'Every page is served by Amplify — no explicit code, it is the deployment platform' },
    ],
  },
];

const GCP_SERVICES = [
  {
    name: 'Cloud Storage',
    badge: 'Storage',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotColor: 'bg-blue-400',
    what: 'GCS bucket zillow-demo-vajeeda stores model artifacts, scoring config, pipeline logs, and the batch output CSV.',
    where: [
      { label: '/pipeline', href: '/pipeline', note: 'Cloud Run scorer result card shows output path gs://zillow-demo-vajeeda/...' },
    ],
  },
  {
    name: 'BigQuery',
    badge: 'Analytics',
    badgeColor: 'bg-green-500/15 text-green-400 border-green-500/30',
    dotColor: 'bg-green-400',
    what: 'Hosts zillow_data dataset with county_stats (3 rows) and predictions (100 rows) tables queried live by the app.',
    where: [
      { label: '/ (Home)', href: '/', note: 'CountyAnalysis chart — SELECT from county_stats on every page load' },
    ],
  },
  {
    name: 'Cloud Run',
    badge: 'Compute',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-400',
    what: 'Runs the zillow-scorer container service exposing /score and /health endpoints for batch scoring.',
    where: [
      { label: '/pipeline', href: '/pipeline', note: '"Run Scorer on Cloud Run" button — POST /score → result card shows rows processed, RMSE, time' },
    ],
  },
  {
    name: 'Cloud Functions',
    badge: 'Serverless',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    dotColor: 'bg-purple-400',
    what: 'model-health function returns a live JSON health report of the model (version, RMSE, last scored, status).',
    where: [
      { label: 'Backend', href: '/pipeline', note: 'Deployed independently; health payload consumed by monitoring systems' },
    ],
  },
  {
    name: 'Firestore',
    badge: 'Database',
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dotColor: 'bg-orange-400',
    what: 'Real-time NoSQL database. Every prediction is written to the predictions collection and streamed live to the monitoring page.',
    where: [
      { label: '/demo', href: '/demo', note: 'Writes prediction result to Firestore after Lambda responds' },
      { label: '/risk-checker', href: '/risk-checker', note: 'Same Firestore write on every prediction' },
      { label: '/explainer', href: '/explainer', note: 'Writes explanation request to Firestore' },
      { label: '/monitoring', href: '/monitoring', note: 'onSnapshot listener — live feed updates in real time as predictions arrive' },
    ],
  },
  {
    name: 'Cloud Monitoring',
    badge: 'Observability',
    badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
    dotColor: 'bg-red-400',
    what: '2 uptime checks (Lambda URL + Cloud Run /health) plus an alerting policy that fires when either endpoint goes down.',
    where: [
      { label: 'GCP Console', href: '/monitoring', note: 'Visible in GCP Console → Monitoring → Uptime Checks' },
    ],
  },
  {
    name: 'Cloud Logging',
    badge: 'Observability',
    badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    dotColor: 'bg-rose-400',
    what: '8 structured pipeline events (zillow-batch-pipeline) and 20 prediction records (zillow-predictions) written as structured logs.',
    where: [
      { label: 'GCP Console', href: '/monitoring', note: 'Visible in GCP Console → Logging → Logs Explorer' },
    ],
  },
  {
    name: 'Cloud Scheduler',
    badge: 'Cron',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    dotColor: 'bg-cyan-400',
    what: 'Two scheduled jobs: zillow-daily-batch-scorer (2 AM every day) and zillow-weekly-model-health-report (Monday 8 AM).',
    where: [
      { label: 'GCP Console', href: '/pipeline', note: 'Visible in GCP Console → Cloud Scheduler' },
    ],
  },
  {
    name: 'Cloud Build',
    badge: 'CI/CD',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    dotColor: 'bg-indigo-400',
    what: 'cloudbuild.yaml defines a trigger: push to main → build Docker image → deploy to Cloud Run automatically.',
    where: [
      { label: 'cloudbuild.yaml', href: '/pipeline', note: 'CI/CD config in repo root; trigger managed in GCP Console → Cloud Build' },
    ],
  },
  {
    name: 'Secret Manager',
    badge: 'Security',
    badgeColor: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    dotColor: 'bg-teal-400',
    what: 'Stores 10 secrets: Lambda URLs, Firebase API key, BigQuery key, SNS ARN, SQS URL, CloudFront domain, model version, pipeline config.',
    where: [
      { label: 'GCP Console', href: '/', note: 'Visible in GCP Console → Secret Manager; app currently reads from .env.local' },
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ServiceCard({
  name, badge, badgeColor, dotColor, what, where,
}: (typeof AWS_SERVICES)[0]) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <h3 className="text-white font-semibold text-sm">{name}</h3>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${badgeColor}`}>
          {badge}
        </span>
      </div>

      {/* What it does */}
      <p className="text-gray-400 text-xs leading-relaxed">{what}</p>

      {/* Where */}
      <div className="space-y-1.5">
        {where.map((w) => (
          <Link
            key={w.label + w.note}
            href={w.href}
            className="flex items-start gap-2 group"
          >
            <span className="mt-0.5 text-[10px] font-mono font-semibold text-gray-300 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 group-hover:border-gray-600 group-hover:text-white transition-colors">
              {w.label}
            </span>
            <span className="text-gray-500 text-[11px] leading-relaxed group-hover:text-gray-400 transition-colors">
              {w.note}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/40 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-blue-400 font-medium uppercase tracking-wider">Cloud Infrastructure</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">20 Cloud Services</h1>
          <p className="text-gray-500 text-sm max-w-2xl">
            Every AWS and GCP service powering this application — what each one does and which page it is active on.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mt-4">
            {[
              { value: '10', label: 'AWS Services', color: 'text-amber-400' },
              { value: '10', label: 'GCP Services', color: 'text-blue-400'  },
              { value: '3',  label: 'Lambda Functions', color: 'text-purple-400' },
              { value: '2',  label: 'Databases', color: 'text-green-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</span>
                <span className="text-gray-500 text-xs">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* AWS Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              {/* AWS icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Amazon Web Services</h2>
              <p className="text-gray-500 text-xs">10 services — predictions, storage, messaging, orchestration</p>
            </div>
            <span className="ml-auto text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              us-east-1
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AWS_SERVICES.map((s) => <ServiceCard key={s.name} {...s} />)}
          </div>
        </section>

        {/* GCP Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              {/* GCP icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Google Cloud Platform</h2>
              <p className="text-gray-500 text-xs">10 services — data, analytics, deployment, security</p>
            </div>
            <span className="ml-auto text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
              us-central1
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GCP_SERVICES.map((s) => <ServiceCard key={s.name} {...s} />)}
          </div>
        </section>

        {/* Architecture summary */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Request Flow</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { label: 'User action',    color: 'border-gray-600 text-gray-300 bg-gray-800'           },
              { label: 'Lambda',         color: 'border-amber-500/40 text-amber-400 bg-amber-500/5'   },
              { label: 'DynamoDB',       color: 'border-blue-500/40 text-blue-400 bg-blue-500/5'      },
              { label: 'Firestore',      color: 'border-orange-500/40 text-orange-400 bg-orange-500/5'},
              { label: 'SNS alert',      color: 'border-rose-500/40 text-rose-400 bg-rose-500/5'      },
              { label: 'SES email',      color: 'border-pink-500/40 text-pink-400 bg-pink-500/5'      },
              { label: 'CloudWatch log', color: 'border-purple-500/40 text-purple-400 bg-purple-500/5'},
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg border font-medium ${step.color}`}>
                  {step.label}
                </span>
                {i < arr.length - 1 && (
                  <svg width="16" height="10" viewBox="0 0 20 10" fill="none" stroke="#4b5563" strokeWidth="1.5">
                    <line x1="0" y1="5" x2="14" y2="5" />
                    <polyline points="9 1 14 5 9 9" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-4">
            A single prediction on <Link href="/demo" className="text-gray-500 hover:text-gray-400 underline underline-offset-2">/demo</Link> simultaneously writes to DynamoDB, Firestore, fires an SNS alert (if logerror &gt; 0.08), and optionally triggers SES — all within one Lambda invocation.
          </p>
        </section>

      </div>
    </div>
  );
}
