"""
seed_aws_services.py
====================
Fills ALL remaining AWS services with realistic data in one script.

Services covered:
  ✅ Lambda          — invokes prediction Lambda 10x to generate logs & metrics
  ✅ S3              — uploads model artifacts + sample CSV to bucket
  ✅ CloudWatch      — creates dashboard + 3 alarms on Lambda metrics
  ✅ SNS             — subscribes your email + publishes a health-report message
  ✅ SQS             — sends 5 scored-parcel job messages to the queue
  ✅ Step Functions  — creates the ML pipeline state machine + runs one execution
  ✅ SES             — creates HTML email template + sends a test prediction report

Prerequisites:
    pip install boto3
    aws configure   (region us-east-1, account 238540685487)

Usage:
    python seed_aws_services.py                         # run all
    python seed_aws_services.py --only lambda           # just Lambda invocations
    python seed_aws_services.py --skip stepfunctions    # skip Step Functions

Available --only / --skip values:
    lambda  s3  cloudwatch  sns  sqs  stepfunctions  ses
"""

import boto3, json, sys, time, uuid, random
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

REGION     = 'us-east-1'
ACCOUNT    = '238540685487'

# ── resource identifiers (from .env.local) ──────────────────────────────────
LAMBDA_URL      = 'https://i3xtbsmgemr5fn7x5pj32jptxi0shfby.lambda-url.us-east-1.on.aws/'
LAMBDA_FN_NAME  = 'zillow-predictor'           # your Lambda function name
S3_BUCKET       = 'zillow-demo-vajeeda'
SNS_ARN         = f'arn:aws:sns:{REGION}:{ACCOUNT}:zillow-price-alerts'
SQS_URL         = f'https://sqs.{REGION}.amazonaws.com/{ACCOUNT}/zillow-prediction-queue'
NOTIFICATION_EMAIL = 'vajeeda.mastan@gmail.com'   # change to your email

# ── sample property inputs ───────────────────────────────────────────────────
SAMPLE_PROPERTIES = [
    {'yearBuilt': 1985, 'finishedSqft': 1800, 'lotSize': 6500,  'taxAmount': 8200,  'taxValue': 620000,  'month': 6,  'county': 'Los Angeles',   'zestimate': 750000},
    {'yearBuilt': 2001, 'finishedSqft': 2400, 'lotSize': 8200,  'taxAmount': 11500, 'taxValue': 890000,  'month': 9,  'county': 'Orange County',  'zestimate': 980000},
    {'yearBuilt': 1962, 'finishedSqft': 1250, 'lotSize': 5400,  'taxAmount': 5800,  'taxValue': 430000,  'month': 3,  'county': 'Los Angeles',   'zestimate': 510000},
    {'yearBuilt': 1978, 'finishedSqft': 3100, 'lotSize': 12000, 'taxAmount': 14200, 'taxValue': 1100000, 'month': 11, 'county': 'Ventura',        'zestimate': 1250000},
    {'yearBuilt': 2008, 'finishedSqft': 2050, 'lotSize': 5000,  'taxAmount': 9800,  'taxValue': 750000,  'month': 5,  'county': 'Orange County',  'zestimate': 830000},
    {'yearBuilt': 1955, 'finishedSqft': 900,  'lotSize': 4200,  'taxAmount': 4200,  'taxValue': 320000,  'month': 8,  'county': 'Los Angeles',   'zestimate': 380000},
    {'yearBuilt': 1993, 'finishedSqft': 1650, 'lotSize': 7300,  'taxAmount': 7600,  'taxValue': 580000,  'month': 2,  'county': 'Ventura',        'zestimate': 640000},
    {'yearBuilt': 2014, 'finishedSqft': 3500, 'lotSize': 9800,  'taxAmount': 18900, 'taxValue': 1450000, 'month': 7,  'county': 'Orange County',  'zestimate': 1600000},
    {'yearBuilt': 1970, 'finishedSqft': 1400, 'lotSize': 6000,  'taxAmount': 6500,  'taxValue': 490000,  'month': 4,  'county': 'Los Angeles',   'zestimate': 555000},
    {'yearBuilt': 1988, 'finishedSqft': 2200, 'lotSize': 8800,  'taxAmount': 10200, 'taxValue': 780000,  'month': 10, 'county': 'Ventura',        'zestimate': 860000},
]

# ── helpers ──────────────────────────────────────────────────────────────────
def section(title: str) -> None:
    print(f'\n{"="*60}')
    print(f'  {title}')
    print('='*60)

def ok(msg: str)   -> None: print(f'  ✓  {msg}')
def warn(msg: str) -> None: print(f'  ⚠  {msg}')
def err(msg: str)  -> None: print(f'  ✗  {msg}')

def client(service: str):
    return boto3.client(service, region_name=REGION)

# ── parse CLI flags ───────────────────────────────────────────────────────────
ALL_STEPS = ['lambda', 's3', 'cloudwatch', 'sns', 'sqs', 'stepfunctions', 'ses']

def should_run(step: str) -> bool:
    args = sys.argv[1:]
    if '--only' in args:
        idx = args.index('--only')
        return step in args[idx+1:]
    if '--skip' in args:
        idx = args.index('--skip')
        return step not in args[idx+1:]
    return True


# ════════════════════════════════════════════════════════════════════════════
# 1. LAMBDA — invoke 10 test predictions
# ════════════════════════════════════════════════════════════════════════════
def seed_lambda() -> None:
    section('Lambda — invoke 10 test predictions')
    try:
        import urllib.request
        import urllib.error

        results = []
        for i, prop in enumerate(SAMPLE_PROPERTIES):
            try:
                payload = json.dumps(prop).encode()
                req = urllib.request.Request(
                    LAMBDA_URL,
                    data=payload,
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    body = json.loads(resp.read())
                    results.append(body)
                    ok(f"[{i+1}/10] county={prop['county']:15s}  "
                       f"logerror={body.get('logerror', '?'):+.4f}  "
                       f"risk={body.get('risk', '?')}")
            except Exception as e:
                warn(f"[{i+1}/10] Lambda call failed: {e}")
            time.sleep(0.3)   # avoid throttle

        ok(f"{len(results)}/10 predictions recorded — Lambda now has CloudWatch logs")

    except Exception as e:
        err(f"Lambda invocations failed: {e}")


# ════════════════════════════════════════════════════════════════════════════
# 2. S3 — upload model artifacts + supporting files
# ════════════════════════════════════════════════════════════════════════════
def seed_s3() -> None:
    section('S3 — upload model artifacts to bucket')
    s3 = client('s3')

    # Model metadata
    model_meta = {
        'model_version':    'v2.3.1',
        'trained_on':       '2024-09-15',
        'cv_rmse':          0.0742,
        'alert_threshold':  0.08,
        'n_train_rows':     2_015_423,
        'n_features':       47,
        'ensemble_weights': {
            'XGBoost':  0.28,
            'LightGBM': 0.31,
            'CatBoost': 0.27,
            'Ridge':    0.14
        },
        'feature_importances': {
            'tax_ratio':         0.312,
            'geo_cluster_te':    0.248,
            'property_age':      0.187,
            'living_area_ratio': 0.134,
            'county_te':         0.119
        },
        's3_artifacts': f's3://{S3_BUCKET}/models/ensemble_v2_3_1/'
    }

    # Feature names
    feature_names = [
        'tax_ratio', 'geo_cluster_te', 'property_age', 'living_area_ratio',
        'county_te', 'structure_land_ratio', 'month_sin', 'month_cos',
        'geo_cluster', 'geo_cluster_density', 'cluster_mean_tax',
        'age_cluster_interaction'
    ]

    # Cluster centres (25 spatial clusters)
    cluster_centres = [
        {'cluster_id': i, 'lat': round(33.7 + i * 0.05 + random.gauss(0, 0.08), 4),
         'lon': round(-118.3 + i * 0.03 + random.gauss(0, 0.06), 4),
         'n_properties': random.randint(4000, 180000),
         'mean_logerror': round(random.gauss(0.008, 0.02), 4)}
        for i in range(25)
    ]

    uploads = [
        ('models/model_metadata.json',   json.dumps(model_meta,     indent=2)),
        ('models/feature_names.json',    json.dumps(feature_names,  indent=2)),
        ('models/cluster_centres.json',  json.dumps(cluster_centres, indent=2)),
        ('config/pipeline_config.json',  json.dumps({
            'chunk_size': 50_000,
            'n_chunks':   58,
            'n_folds':    5,
            'kmeans_k':   25,
            'lgbm_params': {'n_estimators': 800, 'learning_rate': 0.05,
                            'num_leaves': 63, 'min_child_samples': 50}
        }, indent=2)),
    ]

    for key, content in uploads:
        try:
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=content.encode(),
                ContentType='application/json',
            )
            ok(f's3://{S3_BUCKET}/{key}')
        except Exception as e:
            err(f'Failed to upload {key}: {e}')


# ════════════════════════════════════════════════════════════════════════════
# 3. CLOUDWATCH — create dashboard + 3 alarms
# ════════════════════════════════════════════════════════════════════════════
def seed_cloudwatch() -> None:
    section('CloudWatch — create dashboard + 3 alarms')
    cw = client('cloudwatch')

    # Dashboard
    dashboard_body = json.dumps({
        'widgets': [
            {
                'type': 'metric',
                'x': 0, 'y': 0, 'width': 12, 'height': 6,
                'properties': {
                    'title': 'Lambda Invocations',
                    'metrics': [[
                        'AWS/Lambda', 'Invocations',
                        'FunctionName', LAMBDA_FN_NAME,
                        {'stat': 'Sum', 'period': 3600}
                    ]],
                    'view': 'timeSeries',
                    'stacked': False,
                    'region': REGION,
                    'period': 3600
                }
            },
            {
                'type': 'metric',
                'x': 12, 'y': 0, 'width': 12, 'height': 6,
                'properties': {
                    'title': 'Lambda Duration (ms)',
                    'metrics': [
                        ['AWS/Lambda', 'Duration', 'FunctionName', LAMBDA_FN_NAME,
                         {'stat': 'Average', 'period': 3600, 'label': 'Avg'}],
                        ['AWS/Lambda', 'Duration', 'FunctionName', LAMBDA_FN_NAME,
                         {'stat': 'p99',     'period': 3600, 'label': 'p99'}],
                    ],
                    'view': 'timeSeries',
                    'region': REGION,
                    'period': 3600
                }
            },
            {
                'type': 'metric',
                'x': 0, 'y': 6, 'width': 8, 'height': 6,
                'properties': {
                    'title': 'Lambda Errors',
                    'metrics': [[
                        'AWS/Lambda', 'Errors',
                        'FunctionName', LAMBDA_FN_NAME,
                        {'stat': 'Sum', 'period': 3600, 'color': '#d62728'}
                    ]],
                    'view': 'timeSeries',
                    'region': REGION,
                    'period': 3600
                }
            },
            {
                'type': 'metric',
                'x': 8, 'y': 6, 'width': 8, 'height': 6,
                'properties': {
                    'title': 'Lambda Throttles',
                    'metrics': [[
                        'AWS/Lambda', 'Throttles',
                        'FunctionName', LAMBDA_FN_NAME,
                        {'stat': 'Sum', 'period': 3600, 'color': '#ff7f0e'}
                    ]],
                    'view': 'timeSeries',
                    'region': REGION,
                    'period': 3600
                }
            },
            {
                'type': 'metric',
                'x': 16, 'y': 6, 'width': 8, 'height': 6,
                'properties': {
                    'title': 'DynamoDB Read/Write Capacity',
                    'metrics': [
                        ['AWS/DynamoDB', 'ConsumedReadCapacityUnits',
                         'TableName', 'zillow-predictions',
                         {'stat': 'Sum', 'period': 3600, 'label': 'Reads'}],
                        ['AWS/DynamoDB', 'ConsumedWriteCapacityUnits',
                         'TableName', 'zillow-predictions',
                         {'stat': 'Sum', 'period': 3600, 'label': 'Writes'}],
                    ],
                    'view': 'timeSeries',
                    'region': REGION,
                    'period': 3600
                }
            },
        ]
    })

    try:
        cw.put_dashboard(
            DashboardName='ZillowZestimate-ML-Pipeline',
            DashboardBody=dashboard_body
        )
        ok('Dashboard "ZillowZestimate-ML-Pipeline" created')
    except Exception as e:
        err(f'Dashboard creation failed: {e}')

    # Alarms
    alarms = [
        {
            'AlarmName':          'Zillow-Lambda-ErrorRate-High',
            'AlarmDescription':   'Lambda prediction errors > 5 in 5 min — possible model or cold-start issue',
            'MetricName':         'Errors',
            'Namespace':          'AWS/Lambda',
            'Statistic':          'Sum',
            'Dimensions':         [{'Name': 'FunctionName', 'Value': LAMBDA_FN_NAME}],
            'Period':             300,
            'EvaluationPeriods':  1,
            'Threshold':          5.0,
            'ComparisonOperator': 'GreaterThanThreshold',
            'TreatMissingData':   'notBreaching',
            'AlarmActions':       [SNS_ARN],
            'OKActions':          [SNS_ARN],
        },
        {
            'AlarmName':          'Zillow-Lambda-Duration-High',
            'AlarmDescription':   'Lambda p99 duration > 8 s — ensemble inference may be slow',
            'MetricName':         'Duration',
            'Namespace':          'AWS/Lambda',
            'ExtendedStatistic':  'p99',
            'Dimensions':         [{'Name': 'FunctionName', 'Value': LAMBDA_FN_NAME}],
            'Period':             300,
            'EvaluationPeriods':  2,
            'Threshold':          8000.0,
            'ComparisonOperator': 'GreaterThanThreshold',
            'TreatMissingData':   'notBreaching',
            'AlarmActions':       [SNS_ARN],
        },
        {
            'AlarmName':          'Zillow-DynamoDB-Throttles',
            'AlarmDescription':   'DynamoDB write throttles — prediction saves may be dropping',
            'MetricName':         'WriteThrottleEvents',
            'Namespace':          'AWS/DynamoDB',
            'Statistic':          'Sum',
            'Dimensions':         [{'Name': 'TableName', 'Value': 'zillow-predictions'}],
            'Period':             300,
            'EvaluationPeriods':  1,
            'Threshold':          10.0,
            'ComparisonOperator': 'GreaterThanThreshold',
            'TreatMissingData':   'notBreaching',
            'AlarmActions':       [SNS_ARN],
        },
    ]

    for alarm in alarms:
        try:
            # p99 needs ExtendedStatistic (separate kwarg)
            cw.put_metric_alarm(**alarm)
            ok(f'Alarm: {alarm["AlarmName"]}')
        except Exception as e:
            err(f'Alarm {alarm["AlarmName"]} failed: {e}')


# ════════════════════════════════════════════════════════════════════════════
# 4. SNS — subscribe email + publish health report
# ════════════════════════════════════════════════════════════════════════════
def seed_sns() -> None:
    section('SNS — subscribe email + publish monthly health report')
    sns = client('sns')

    # Subscribe email to the topic
    try:
        resp = sns.subscribe(
            TopicArn=SNS_ARN,
            Protocol='email',
            Endpoint=NOTIFICATION_EMAIL,
            ReturnSubscriptionArn=True,
        )
        ok(f'Email subscription created for {NOTIFICATION_EMAIL}')
        warn('Check your inbox and confirm the subscription link from AWS')
    except Exception as e:
        err(f'SNS subscribe failed: {e}')

    # Publish a model health report
    report_msg = {
        'report_type':    'Monthly Model Health Report',
        'generated_at':   datetime.utcnow().isoformat(),
        'model_version':  'v2.3.1',
        'cv_rmse':        0.0742,
        'drift_status':   'OK',
        'total_predictions_30d': 28441,
        'overpriced_pct': 54.2,
        'underpriced_pct': 22.8,
        'fair_pct':        23.0,
        'top_drifting_feature': 'tax_ratio',
        'top_drift_psi':   0.09,
        'counties': {
            'Los Angeles':   {'mean_logerror': 0.0145, 'n': 20477},
            'Orange County': {'mean_logerror': -0.0091, 'n':  5688},
            'Ventura':       {'mean_logerror':  0.0029, 'n':  2276},
        }
    }

    try:
        sns.publish(
            TopicArn=SNS_ARN,
            Subject='[Zillow ML] Monthly Model Health Report — RMSE 0.0742 · Drift: OK',
            Message=json.dumps(report_msg, indent=2),
            MessageAttributes={
                'report_type': {
                    'DataType': 'String',
                    'StringValue': 'health_report'
                }
            }
        )
        ok('Published monthly health report to SNS topic')
    except Exception as e:
        err(f'SNS publish failed: {e}')

    # Publish a simulated extreme-mispricing alert (logerror > 0.08)
    try:
        sns.publish(
            TopicArn=SNS_ARN,
            Subject='Alert: OVERPRICED property in Los Angeles',
            Message=(
                'logerror: +0.0913\n'
                'Estimated mispricing on $1,450,000 property\n'
                'county: Los Angeles | cluster: 7\n'
                'tax_ratio: 0.01812 — significantly above county median'
            ),
        )
        ok('Published extreme-mispricing alert to SNS topic')
    except Exception as e:
        err(f'SNS alert publish failed: {e}')


# ════════════════════════════════════════════════════════════════════════════
# 5. SQS — send 5 batch scoring job messages
# ════════════════════════════════════════════════════════════════════════════
def seed_sqs() -> None:
    section('SQS — send 5 batch scoring job messages')
    sqs = client('sqs')

    jobs = [
        {'job_id': f'batch-{random.randint(10000,99999)}',
         'parcel_ids': [10754147 + i * 13 for i in range(500)],
         'county': county,
         'submitted_at': datetime.utcnow().isoformat(),
         'priority': priority,
         'requested_by': 'zillow-ml-pipeline'}
        for county, priority in [
            ('Los Angeles',   'normal'),
            ('Orange County', 'normal'),
            ('Ventura',       'low'),
            ('Los Angeles',   'high'),
            ('Orange County', 'normal'),
        ]
    ]

    for job in jobs:
        try:
            sqs.send_message(
                QueueUrl=SQS_URL,
                MessageBody=json.dumps(job),
                MessageAttributes={
                    'job_type': {'DataType': 'String', 'StringValue': 'batch_score'},
                    'county':   {'DataType': 'String', 'StringValue': job['county']},
                    'priority': {'DataType': 'String', 'StringValue': job['priority']},
                }
            )
            ok(f"Job {job['job_id']} → {job['county']} ({job['priority']}) — {len(job['parcel_ids'])} parcels")
        except Exception as e:
            err(f"SQS send failed for {job['job_id']}: {e}")

    # Check queue depth
    try:
        attrs = sqs.get_queue_attributes(
            QueueUrl=SQS_URL,
            AttributeNames=['ApproximateNumberOfMessages']
        )
        depth = attrs['Attributes'].get('ApproximateNumberOfMessages', '?')
        ok(f'Queue depth: ~{depth} messages visible')
    except Exception as e:
        warn(f'Could not check queue depth: {e}')


# ════════════════════════════════════════════════════════════════════════════
# 6. STEP FUNCTIONS — create ML pipeline state machine + run one execution
# ════════════════════════════════════════════════════════════════════════════
def seed_stepfunctions() -> None:
    section('Step Functions — create ML pipeline state machine + run execution')
    sf = client('stepfunctions')

    # State machine definition (mirrors the 5-step pipeline shown in UI)
    definition = json.dumps({
        'Comment': 'Zillow Zestimate Batch ML Pipeline — orchestrates data loading, feature engineering, ensemble scoring, and output delivery.',
        'StartAt': 'LoadData',
        'States': {
            'LoadData': {
                'Type': 'Task',
                'Comment': 'Load 2.9M property rows from S3, partition into 58 chunks of 50K',
                'Resource': 'arn:aws:states:::lambda:invoke',
                'Parameters': {
                    'FunctionName': LAMBDA_FN_NAME,
                    'Payload': {
                        'action': 'load_data',
                        'bucket': S3_BUCKET,
                        'key': 'data/properties_2016.parquet',
                        'chunk_size': 50000
                    }
                },
                'ResultPath': '$.load_result',
                'Next': 'FeatureEngineering',
                'Retry': [{'ErrorEquals': ['States.TaskFailed'], 'MaxAttempts': 2}],
                'Catch': [{'ErrorEquals': ['States.ALL'], 'Next': 'PipelineFailed'}]
            },
            'FeatureEngineering': {
                'Type': 'Task',
                'Comment': 'Compute 12 engineered features: tax ratios, age, area ratios, spatial clusters, target encodings',
                'Resource': 'arn:aws:states:::lambda:invoke',
                'Parameters': {
                    'FunctionName': LAMBDA_FN_NAME,
                    'Payload': {
                        'action': 'feature_engineering',
                        'kmeans_k': 25,
                        'cv_folds': 5
                    }
                },
                'ResultPath': '$.fe_result',
                'Next': 'RunEnsemble',
                'Retry': [{'ErrorEquals': ['States.TaskFailed'], 'MaxAttempts': 2}]
            },
            'RunEnsemble': {
                'Type': 'Task',
                'Comment': 'Score all chunks with stacked ensemble: XGBoost + LightGBM + CatBoost + Ridge meta-model',
                'Resource': 'arn:aws:states:::lambda:invoke',
                'Parameters': {
                    'FunctionName': LAMBDA_FN_NAME,
                    'Payload': {
                        'action': 'run_ensemble',
                        'models': ['xgboost', 'lightgbm', 'catboost', 'ridge'],
                        'model_version': 'v2.3.1'
                    }
                },
                'ResultPath': '$.ensemble_result',
                'Next': 'SaveResults',
                'Retry': [{'ErrorEquals': ['States.TaskFailed'], 'MaxAttempts': 2}]
            },
            'SaveResults': {
                'Type': 'Parallel',
                'Comment': 'Fan-out: simultaneously write to DynamoDB and save Parquet to S3',
                'Branches': [
                    {
                        'StartAt': 'SaveToDynamoDB',
                        'States': {
                            'SaveToDynamoDB': {
                                'Type': 'Task',
                                'Resource': 'arn:aws:states:::dynamodb:putItem',
                                'Parameters': {
                                    'TableName': 'zillow-predictions',
                                    'Item': {
                                        'predictionId': {'S.$': '$.ensemble_result.job_id'},
                                        'timestamp':    {'S.$': '$$.Execution.StartTime'}
                                    }
                                },
                                'End': True
                            }
                        }
                    },
                    {
                        'StartAt': 'SaveToS3',
                        'States': {
                            'SaveToS3': {
                                'Type': 'Task',
                                'Resource': 'arn:aws:states:::lambda:invoke',
                                'Parameters': {
                                    'FunctionName': LAMBDA_FN_NAME,
                                    'Payload': {
                                        'action': 'save_parquet',
                                        'bucket': S3_BUCKET,
                                        'key': 'predictions/scored_2016.parquet'
                                    }
                                },
                                'End': True
                            }
                        }
                    }
                ],
                'ResultPath': '$.save_result',
                'Next': 'SendAlerts'
            },
            'SendAlerts': {
                'Type': 'Task',
                'Comment': 'Publish SNS alert for any property with |logerror| > 0.08',
                'Resource': 'arn:aws:states:::sns:publish',
                'Parameters': {
                    'TopicArn': SNS_ARN,
                    'Message': 'Batch pipeline complete. See S3 for full results.',
                    'Subject': '[Zillow ML] Batch scoring complete'
                },
                'ResultPath': '$.alert_result',
                'Next': 'PipelineComplete'
            },
            'PipelineComplete': {
                'Type': 'Succeed',
                'Comment': 'All 2.9M properties scored and results persisted.'
            },
            'PipelineFailed': {
                'Type': 'Fail',
                'Error': 'PipelineError',
                'Cause': 'One or more pipeline stages failed. Check CloudWatch logs.'
            }
        }
    })

    state_machine_arn = None
    role_arn = f'arn:aws:iam::{ACCOUNT}:role/StepFunctionsLambdaRole'

    try:
        resp = sf.create_state_machine(
            name='ZillowZestimate-MLPipeline',
            definition=definition,
            roleArn=role_arn,
            type='STANDARD',
            tags=[
                {'key': 'project', 'value': 'zillow-zestimate'},
                {'key': 'env',     'value': 'production'},
            ]
        )
        state_machine_arn = resp['stateMachineArn']
        ok(f'State machine created: {state_machine_arn}')
    except sf.exceptions.StateMachineAlreadyExists:
        # Get existing ARN
        existing = sf.list_state_machines()
        for sm in existing.get('stateMachines', []):
            if sm['name'] == 'ZillowZestimate-MLPipeline':
                state_machine_arn = sm['stateMachineArn']
        ok(f'State machine already exists — using {state_machine_arn}')
    except Exception as e:
        err(f'Step Functions create failed: {e}')
        warn('If role does not exist, create StepFunctionsLambdaRole in IAM first.')
        return

    # Start an execution
    if state_machine_arn:
        try:
            exec_resp = sf.start_execution(
                stateMachineArn=state_machine_arn,
                name=f'manual-run-{datetime.utcnow().strftime("%Y%m%d-%H%M%S")}',
                input=json.dumps({
                    'triggered_by': 'seed_script',
                    'dataset':      '2016_properties',
                    'mode':         'full_batch'
                })
            )
            ok(f'Execution started: {exec_resp["executionArn"]}')
            ok('View at: AWS Console → Step Functions → ZillowZestimate-MLPipeline')
        except Exception as e:
            err(f'Execution start failed: {e}')


# ════════════════════════════════════════════════════════════════════════════
# 7. SES — create email template + send a test prediction report
# ════════════════════════════════════════════════════════════════════════════
def seed_ses() -> None:
    section('SES — create email template + send test prediction report')
    ses = client('ses')

    # Create HTML template for prediction reports
    html_body = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0}
  .wrap{max-width:600px;margin:0 auto;padding:32px 24px}
  .header{border-bottom:1px solid #1e293b;margin-bottom:24px;padding-bottom:16px}
  .badge{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:700}
  .over{background:#7f1d1d;color:#fca5a5}.fair{background:#1c3244;color:#93c5fd}
  .under{background:#14532d;color:#86efac}
  .metric{background:#1e293b;border-radius:8px;padding:12px 16px;margin:8px 0}
  .label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .value{font-size:22px;font-weight:700;font-family:monospace}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #1e293b;
          font-size:11px;color:#475569}
  a{color:#f59e0b}
</style></head>
<body><div class="wrap">
  <div class="header">
    <div style="font-size:20px;font-weight:700">Zillow Zestimate Analysis Report</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px">
      Powered by XGBoost + LightGBM + CatBoost ensemble · CV RMSE 0.0742
    </div>
  </div>

  <p>Your property analysis is ready.</p>

  <div class="metric">
    <div class="label">County</div>
    <div style="font-size:16px;font-weight:600">{{county}}</div>
  </div>

  <div class="metric">
    <div class="label">Predicted Log-error</div>
    <div class="value" style="color:#f59e0b">{{logerror}}</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px">
      CI: [{{conf_low}}, {{conf_high}}]
    </div>
  </div>

  <div class="metric">
    <div class="label">Risk Assessment</div>
    <div style="margin-top:6px">
      <span class="badge {{risk_class}}">{{risk}}</span>
    </div>
    <div style="font-size:13px;color:#94a3b8;margin-top:8px">{{risk_summary}}</div>
  </div>

  <div class="metric">
    <div class="label">Estimated True Value Range</div>
    <div style="font-size:14px;font-weight:600;margin-top:4px">
      {{true_low}} — {{true_high}}
    </div>
    <div style="font-size:12px;color:#64748b">Zillow says: {{zestimate}}</div>
  </div>

  <div style="margin-top:24px;padding:12px 16px;background:#1e293b;border-radius:8px;
              border-left:3px solid #f59e0b">
    <div style="font-size:12px;color:#94a3b8">
      <strong style="color:#fbbf24">Top feature driving this prediction:</strong>
      <br>Tax ratio was the most influential input — it accounts for ~31% of the model's output.
    </div>
  </div>

  <div class="footer">
    This report was generated automatically by the Zillow Zestimate Ensemble Model.
    Delivered via <strong>AWS SES</strong>. For full interactive analysis visit the
    <a href="https://zillow-zestimate.vercel.app">live demo</a>.
    <br><br>
    This is for informational purposes only and does not constitute financial advice.
  </div>
</div></body></html>
"""

    try:
        ses.create_template(
            Template={
                'TemplateName': 'ZillowPredictionReport',
                'SubjectPart':  'Your Zillow Zestimate Analysis — {{county}} · {{risk}}',
                'TextPart':     (
                    'Your Zillow Zestimate analysis is ready.\n\n'
                    'County: {{county}}\nLog-error: {{logerror}}\nRisk: {{risk}}\n'
                    'Zestimate: {{zestimate}}\n\nThis analysis is powered by the Zillow Zestimate Ensemble Model.'
                ),
                'HtmlPart':     html_body,
            }
        )
        ok('Email template "ZillowPredictionReport" created in SES')
    except ses.exceptions.AlreadyExistsException:
        ok('Template "ZillowPredictionReport" already exists')
    except Exception as e:
        err(f'Template creation failed: {e}')

    # Send a test prediction report
    try:
        ses.send_email(
            Source=NOTIFICATION_EMAIL,   # must be SES-verified
            Destination={'ToAddresses': [NOTIFICATION_EMAIL]},
            Message={
                'Subject': {'Data': 'Your Zillow Zestimate Analysis — Los Angeles · OVERPRICED'},
                'Body': {
                    'Html': {
                        'Data': html_body
                            .replace('{{county}}',      'Los Angeles')
                            .replace('{{logerror}}',    '+0.0782')
                            .replace('{{conf_low}}',    '+0.0602')
                            .replace('{{conf_high}}',   '+0.0962')
                            .replace('{{risk}}',        'OVERPRICED')
                            .replace('{{risk_class}}',  'over')
                            .replace('{{risk_summary}}', 'Zillow may be overestimating this property by ~8%')
                            .replace('{{true_low}}',    '$687,200')
                            .replace('{{true_high}}',   '$735,600')
                            .replace('{{zestimate}}',   '$750,000')
                    }
                }
            }
        )
        ok(f'Test prediction report sent to {NOTIFICATION_EMAIL}')
    except ses.exceptions.MessageRejected as e:
        warn(f'Email not sent — sender not verified in SES: {e}')
        warn(f'Verify {NOTIFICATION_EMAIL} in SES Console → Verified identities')
    except Exception as e:
        err(f'SES send failed: {e}')


# ════════════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════════════
def main() -> None:
    steps = {
        'lambda':       seed_lambda,
        's3':           seed_s3,
        'cloudwatch':   seed_cloudwatch,
        'sns':          seed_sns,
        'sqs':          seed_sqs,
        'stepfunctions': seed_stepfunctions,
        'ses':          seed_ses,
    }

    for name, fn in steps.items():
        if should_run(name):
            try:
                fn()
            except Exception as e:
                err(f'{name} step crashed: {e}')
                print('  Continuing with remaining steps…')

    print(f'\n\nAll AWS services seeded.')
    print('Check the AWS Console to verify:')
    print('  CloudWatch → Dashboards → ZillowZestimate-ML-Pipeline')
    print('  Step Functions → ZillowZestimate-MLPipeline')
    print('  SES → Email Templates → ZillowPredictionReport')
    print('  SNS → Topics → zillow-price-alerts → Subscriptions')
    print('  SQS → zillow-prediction-queue → Send and receive messages')
    print('  S3 → zillow-demo-vajeeda → models/')


if __name__ == '__main__':
    main()
