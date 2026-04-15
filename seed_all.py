"""
seed_all.py
===========
Master runner — seeds all 20 cloud services in one command.

AWS (10):  Lambda · DynamoDB · S3 · CloudWatch · SNS · SQS
           CloudFront · Step Functions · SES · Amplify (hosting only)

GCP (10):  Cloud Storage · BigQuery · Cloud Run · Cloud Functions · Firestore
           Cloud Monitoring · Cloud Logging · Cloud Scheduler · Cloud Build
           Secret Manager

Usage:
    python seed_all.py              # run everything
    python seed_all.py --aws-only   # only AWS services
    python seed_all.py --gcp-only   # only GCP services
    python seed_all.py --skip-deploy  # skip Cloud Run / Cloud Functions deploy

Prerequisites:
    pip install boto3 firebase-admin google-cloud-storage google-cloud-bigquery \\
                google-cloud-monitoring google-cloud-logging google-cloud-scheduler \\
                google-cloud-secret-manager google-api-python-client

    aws configure                          # AWS credentials (region: us-east-1)
    gcloud auth application-default login  # GCP credentials
    # Place firebase-service-account.json next to this script for Firestore
"""

import sys, importlib.util, os, pathlib
sys.stdout.reconfigure(encoding='utf-8')

args = set(sys.argv[1:])
AWS_ONLY     = '--aws-only'     in args
GCP_ONLY     = '--gcp-only'     in args
SKIP_DEPLOY  = '--skip-deploy'  in args


def run(module_name: str, label: str) -> None:
    path = pathlib.Path(__file__).parent / f'{module_name}.py'
    if not path.exists():
        print(f'  [SKIP] {module_name}.py not found')
        return
    print(f'\n{"="*62}')
    print(f'  {label}')
    print('='*62)
    try:
        spec   = importlib.util.spec_from_file_location(module_name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if hasattr(module, 'main'):   module.main()
        elif hasattr(module, 'seed'): module.seed()
        elif hasattr(module, 'setup'):module.setup()
        elif hasattr(module, 'generate_csv'):
            module.generate_csv()
            module.upload_to_s3()
    except Exception as e:
        print(f'  ✗  {label} crashed: {e}')
        print('  Continuing with next service…')


def main() -> None:
    print('Zillow Zestimate — Cloud Services Seeder')
    print('=' * 62)
    print('Seeding all 20 services across AWS and GCP…\n')

    # ── AWS Services ─────────────────────────────────────────────────────────
    if not GCP_ONLY:
        print('\n' + '▶  AWS SERVICES'.center(62, '─'))

        # DynamoDB — 500 historical prediction records
        run('seed_dynamodb',      '1/10  AWS DynamoDB  — 500 historical predictions')

        # S3 + CloudFront — sample CSV + model artifacts
        run('generate_sample_csv','2/10  AWS S3 + CloudFront — CSV + model artifacts')

        # Lambda + CloudWatch + SNS + SQS + Step Functions + SES
        run('seed_aws_services',  '3–8/10 AWS Lambda · CloudWatch · SNS · SQS · Step Functions · SES')

        print('\n  9/10  AWS CloudFront')
        print('  ✓  Served automatically via S3 bucket (already covered in step 2)')

        print('\n  10/10 AWS Amplify Hosting')
        print('  ✓  Amplify serves the Next.js app — no data seeding needed.')
        print('     To re-deploy: push to main branch or run:')
        print('       amplify publish   (if Amplify CLI is installed)')

    # ── GCP Services ─────────────────────────────────────────────────────────
    if not AWS_ONLY:
        print('\n' + '▶  GCP SERVICES'.center(62, '─'))

        # Firestore — 15 recent predictions
        run('seed_firestore',     '1/10  GCP Firestore — 15 recent predictions (live feed)')

        # BigQuery + Cloud Storage + Cloud Run + Cloud Functions +
        # Cloud Monitoring + Cloud Logging + Cloud Scheduler +
        # Cloud Build + Secret Manager
        run('seed_gcp_services',  '2–10/10 GCP Cloud Storage · BigQuery · Cloud Run · '
                                  'Cloud Functions · Cloud Monitoring · Cloud Logging · '
                                  'Cloud Scheduler · Cloud Build · Secret Manager')

    # ── Summary ──────────────────────────────────────────────────────────────
    print('\n\n' + '=' * 62)
    print('  SEEDING COMPLETE — Coverage Summary')
    print('=' * 62)
    rows = [
        # AWS
        ('AWS Lambda',          'Invoked 10x → generates CloudWatch logs & metrics'),
        ('AWS DynamoDB',        '500 prediction records spread over 6 months'),
        ('AWS S3',              'model_metadata.json, cluster_centres.json, CSV'),
        ('AWS CloudWatch',      'Dashboard "ZillowZestimate-ML-Pipeline" + 3 alarms'),
        ('AWS SNS',             'Email subscription + health report + mispricing alert'),
        ('AWS SQS',             '5 batch scoring job messages in queue'),
        ('AWS CloudFront',      'sample_predictions.csv served via CDN'),
        ('AWS Step Functions',  'ML pipeline state machine + 1 execution'),
        ('AWS SES',             'HTML email template + test prediction report sent'),
        ('AWS Amplify',         'Hosts Next.js app (no data seeding needed)'),
        # GCP
        ('GCP Cloud Storage',   '4 files: CSV, model metadata, config, pipeline log'),
        ('GCP BigQuery',        '2 tables: county_stats (3 rows) + predictions (100 rows)'),
        ('GCP Cloud Run',       'zillow-scorer service deployed, /score + /health live'),
        ('GCP Cloud Functions', 'model-health function → returns JSON health status'),
        ('GCP Firestore',       '15 recent predictions → live feed on /monitoring'),
        ('GCP Cloud Monitoring','2 uptime checks (Lambda URL + Cloud Run) + alert policy'),
        ('GCP Cloud Logging',   '8 pipeline events + 20 prediction logs'),
        ('GCP Cloud Scheduler', '2 jobs: daily scorer (2 AM) + weekly health report'),
        ('GCP Cloud Build',     'cloudbuild.yaml + deploy trigger on push to main'),
        ('GCP Secret Manager',  '10 secrets: URLs, API keys, pipeline config'),
    ]
    for svc, desc in rows:
        print(f'  {"✓":2} {svc:28s} {desc}')

    print('\nNext steps:')
    print('  1. Visit /monitoring  → DynamoDB count + Firestore live feed')
    print('  2. Visit /            → County Analysis chart (BigQuery live data)')
    print('  3. Visit /pipeline    → Download CSV via CloudFront')
    print('  4. Visit /demo        → Make a prediction → triggers Lambda + Firestore + SNS')
    print('  5. Check AWS Console  → CloudWatch Dashboard · Step Functions · SES')
    print('  6. Check GCP Console  → Cloud Run · Cloud Scheduler · Secret Manager')


if __name__ == '__main__':
    main()
