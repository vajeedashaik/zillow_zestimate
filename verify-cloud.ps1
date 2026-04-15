# ============================================================
#  Cloud Services Verification — Zillow Zestimate Project
#  Prerequisites:
#    AWS  →  aws configure   (region: us-east-1)
#    GCP  →  gcloud auth login  &&  gcloud config set project cap-expt-492003
# ============================================================

$pass   = [System.Collections.Generic.List[string]]::new()
$fail   = [System.Collections.Generic.List[string]]::new()
$detail = [System.Collections.Generic.List[string]]::new()

function Test-Service {
    param(
        [string]   $Name,
        [scriptblock] $Block,
        [string]   $Expect = ""
    )
    Write-Host "`n── $Name " -NoNewline -ForegroundColor Cyan
    try {
        $result = & $Block
        Write-Host "✅ PASS" -ForegroundColor Green
        if ($Expect) { Write-Host "   → $Expect" -ForegroundColor DarkGreen }
        if ($result)  { Write-Host "   → $result" -ForegroundColor DarkGray }
        $script:pass.Add($Name)
    } catch {
        Write-Host "❌ FAIL" -ForegroundColor Red
        Write-Host "   → $($_.Exception.Message)" -ForegroundColor DarkRed
        $script:fail.Add($Name)
        $script:detail.Add("${Name}: $($_.Exception.Message)")
    }
}

# ──────────────────────────────────────────────────────────────
#  CONSTANTS  (pulled from .env.local)
# ──────────────────────────────────────────────────────────────
$LAMBDA_PREDICT  = "https://i3xtbsmgemr5fn7x5pj32jptxi0shfby.lambda-url.us-east-1.on.aws/"
$LAMBDA_COUNT    = "https://whogodszx4m5wdpsfpwht4kmei0coctc.lambda-url.us-east-1.on.aws/"
$LAMBDA_SES      = "https://6c6ocnbgd3o7b3slga25wkouza0mcnrq.lambda-url.us-east-1.on.aws/"
$SNS_ARN         = "arn:aws:sns:us-east-1:238540685487:zillow-price-alerts"
$SQS_URL         = "https://sqs.us-east-1.amazonaws.com/238540685487/zillow-prediction-queue"
$CF_URL          = "https://d3al9xtnn673r8.cloudfront.net/sample_predictions.csv"
$GCP_PROJECT     = "cap-expt-492003"
$FIREBASE_PROJECT= "cap-expt-492003"

$REGION          = "us-east-1"


# ══════════════════════════════════════════════════════════════
#  AWS SERVICES
# ══════════════════════════════════════════════════════════════
Write-Host "`n╔══════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║   AWS SERVICES (1–10)        ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════╝" -ForegroundColor Yellow

# ── 1. Lambda ──────────────────────────────────────────────────
Test-Service "1. Lambda (Prediction)" {
    $body = @{
        yearBuilt    = 1985
        finishedSqft = 1800
        lotSize      = 6500
        taxAmount    = 8200
        taxValue     = 620000
        month        = 6
        county       = "Los Angeles"
        zestimate    = 750000
    } | ConvertTo-Json -Compress

    $r = Invoke-RestMethod -Uri $LAMBDA_PREDICT `
                           -Method POST `
                           -ContentType "application/json" `
                           -Body $body `
                           -TimeoutSec 15

    if ($null -eq $r.logerror) { throw "Response missing 'logerror' field. Got: $($r | ConvertTo-Json -Compress)" }
    "logerror=$($r.logerror)  risk=$($r.risk)  CI=[$($r.confidence_low), $($r.confidence_high)]"
} -Expect "JSON with logerror, risk, confidence_low, confidence_high"


# ── 2. DynamoDB ────────────────────────────────────────────────
Test-Service "2. DynamoDB (via Count Lambda)" {
    $r = Invoke-RestMethod -Uri $LAMBDA_COUNT -Method GET -TimeoutSec 10
    $val = if ($null -ne $r.total) { $r.total } elseif ($null -ne $r.count) { $r.count } elseif ($null -ne $r.total_predictions) { $r.total_predictions } else { $null }
    if ($null -eq $val) {
        throw "Response missing count field. Got: $($r | ConvertTo-Json -Compress)"
    }
    "total predictions in DynamoDB = $val"
} -Expect "{ total_predictions: <number> }"

# Bonus — direct table check via AWS CLI
Write-Host "   [CLI check]" -ForegroundColor DarkGray
try {
    $tables = aws dynamodb list-tables --region $REGION | ConvertFrom-Json
    Write-Host "   → DynamoDB tables visible: $($tables.TableNames -join ', ')" -ForegroundColor DarkGray
} catch {
    Write-Host "   → AWS CLI not configured or no IAM access" -ForegroundColor DarkYellow
}


# ── 3. S3 ──────────────────────────────────────────────────────
Test-Service "3. S3 (CloudFront origin reachable)" {
    # Test via CloudFront which proxies S3 — if CF works the S3 bucket is accessible
    $r = Invoke-WebRequest -Uri $CF_URL -Method HEAD -TimeoutSec 10 -UseBasicParsing
    if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode) — expected 200" }
    "HTTP $($r.StatusCode)  Content-Type: $($r.Headers['Content-Type'])"
} -Expect "HTTP 200 HEAD on CloudFront URL (which reads from S3)"

# Direct bucket list via CLI
Write-Host "   [CLI check]" -ForegroundColor DarkGray
try {
    $buckets = aws s3 ls --region $REGION 2>&1
    $zillowBuckets = $buckets | Where-Object { $_ -match "zillow" }
    if ($zillowBuckets) {
        Write-Host "   → Zillow S3 buckets: $zillowBuckets" -ForegroundColor DarkGray
    } else {
        Write-Host "   → No zillow-named buckets found (may be named differently)" -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "   → AWS CLI not configured" -ForegroundColor DarkYellow
}


# ── 4. CloudWatch ──────────────────────────────────────────────
Test-Service "4. CloudWatch" {
    $raw = aws cloudwatch list-metrics `
               --namespace "AWS/Lambda" `
               --region $REGION `
               --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI error: $raw" }
    $r = $raw | ConvertFrom-Json
    "Lambda metrics available: $($r.Metrics.Count) entries"
} -Expect "Non-empty Metrics array for AWS/Lambda namespace"


# ── 5. SNS ─────────────────────────────────────────────────────
Test-Service "5. SNS" {
    $raw = aws sns get-topic-attributes `
               --topic-arn $SNS_ARN `
               --region $REGION `
               --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI error: $raw" }
    $r = $raw | ConvertFrom-Json
    "Topic: $($r.Attributes.TopicArn)  Subscriptions=$($r.Attributes.SubscriptionsConfirmed)"
} -Expect "Attributes object with TopicArn and SubscriptionsConfirmed"


# ── 6. SQS ─────────────────────────────────────────────────────
Test-Service "6. SQS" {
    $raw = aws sqs get-queue-attributes `
               --queue-url $SQS_URL `
               --attribute-names ApproximateNumberOfMessages `
                                  ApproximateNumberOfMessagesNotVisible `
                                  CreatedTimestamp `
               --region $REGION `
               --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI error: $raw" }
    $r = $raw | ConvertFrom-Json
    "Messages in queue: $($r.Attributes.ApproximateNumberOfMessages)  InFlight: $($r.Attributes.ApproximateNumberOfMessagesNotVisible)"
} -Expect "Attributes with ApproximateNumberOfMessages (0 is fine)"


# ── 7. CloudFront ──────────────────────────────────────────────
Test-Service "7. CloudFront (CDN CSV download)" {
    $r = Invoke-WebRequest -Uri $CF_URL -TimeoutSec 15 -UseBasicParsing
    if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
    $lines = ($r.Content -split "`n").Count
    $xCache = if ($r.Headers['X-Cache']) { $r.Headers['X-Cache'] } elseif ($r.Headers['x-cache']) { $r.Headers['x-cache'] } else { 'n/a' }
    "HTTP 200  rows-in-file ~= $lines  Via: $xCache"
} -Expect "HTTP 200, CSV body, X-Cache header (Hit/Miss from CloudFront)"


# ── 8. Step Functions ──────────────────────────────────────────
Test-Service "8. Step Functions" {
    $raw = aws stepfunctions list-state-machines `
               --region $REGION `
               --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI error: $raw" }
    $r = $raw | ConvertFrom-Json
    if ($r.stateMachines.Count -eq 0) {
        "API reachable — no state machines deployed yet"
    } else {
        "State machines: $($r.stateMachines.name -join ', ')"
    }
} -Expect "Empty list or list of state machine names (empty = API accessible, no SM deployed)"


# ── 9. SES ─────────────────────────────────────────────────────
Test-Service "9. SES" {
    # Test 1: check send quota via CLI
    $raw = aws ses get-send-quota --region $REGION --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI error: $raw" }
    $q = $raw | ConvertFrom-Json
    "Max24HourSend=$($q.Max24HourSend)  SentLast24Hours=$($q.SentLast24Hours)  MaxSendRate=$($q.MaxSendRate)/s"
} -Expect "Send quota numbers — SentLast24Hours > 0 means emails went out"

# Bonus — call the SES Lambda directly (sends a real test email)
Write-Host "   [Optional: send a real test email via SES Lambda]" -ForegroundColor DarkGray
Write-Host "   Run manually to avoid inbox noise:" -ForegroundColor DarkGray
Write-Host '   Invoke-RestMethod -Uri $LAMBDA_SES -Method POST -ContentType "application/json" -Body (''{"email":"kittutheboss1@gmail.com","county":"Los Angeles","risk":"FAIR","logerror":0.01,"zestimate":500000}'' | ConvertTo-Json -Compress)' -ForegroundColor DarkGray


# ── 10. Amplify Hosting ────────────────────────────────────────
Test-Service "10. Amplify Hosting" {
    $raw = aws amplify list-apps --region $REGION --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI error: $raw" }
    $r = $raw | ConvertFrom-Json
    if ($r.apps.Count -eq 0) {
        "API reachable — no Amplify apps deployed in $REGION"
    } else {
        "Apps: $($r.apps.name -join ', ')  Domains: $($r.apps.defaultDomain -join ', ')"
    }
} -Expect "List of Amplify apps or empty list (empty = API accessible, no app deployed)"


# ══════════════════════════════════════════════════════════════
#  GCP SERVICES
# ══════════════════════════════════════════════════════════════
Write-Host "`n╔══════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   GCP SERVICES (11–20)       ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════╝" -ForegroundColor Magenta


# ── 11. Cloud Storage ──────────────────────────────────────────
Test-Service "11. Cloud Storage" {
    $raw = gcloud storage ls --project $GCP_PROJECT 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud error: $raw" }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        "API reachable — no buckets found in project $GCP_PROJECT"
    } else {
        "Buckets: $($raw -join '  ')"
    }
} -Expect "List of gs:// bucket URLs or empty (empty = API accessible)"


# ── 12. BigQuery ───────────────────────────────────────────────
Test-Service "12. BigQuery" {
    $gcToken = (gcloud auth print-access-token 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "gcloud token error: $gcToken" }
    $gcToken = $gcToken.Trim()

    $bqBody = @{
        query        = "SELECT 1 AS ping"
        useLegacySql = $false
        timeoutMs    = 5000
    } | ConvertTo-Json -Compress

    $r = Invoke-RestMethod `
            -Uri "https://bigquery.googleapis.com/bigquery/v2/projects/$GCP_PROJECT/queries" `
            -Method POST `
            -ContentType "application/json" `
            -Headers @{ Authorization = "Bearer $gcToken" } `
            -Body $bqBody `
            -TimeoutSec 15

    if ($r.jobComplete -ne $true) { throw "Query did not complete. Response: $($r | ConvertTo-Json -Compress)" }
    "jobComplete=$($r.jobComplete)  rows=$($r.totalRows)  cacheHit=$($r.cacheHit)"
} -Expect "jobComplete=True, totalRows=1"

# Bonus — check for the county_stats table used by the app
Write-Host "   [Check county_stats table]" -ForegroundColor DarkGray
try {
    $gcToken2 = (gcloud auth print-access-token 2>&1).Trim()
    $tableBody = @{
        query        = "SELECT COUNT(*) as n FROM ``$GCP_PROJECT.zillow_data.county_stats``"
        useLegacySql = $false
        timeoutMs    = 8000
    } | ConvertTo-Json -Compress
    $tr = Invoke-RestMethod `
              -Uri "https://bigquery.googleapis.com/bigquery/v2/projects/$GCP_PROJECT/queries" `
              -Method POST -ContentType "application/json" `
              -Headers @{ Authorization = "Bearer $gcToken2" } `
              -Body $tableBody -TimeoutSec 15 -ErrorAction SilentlyContinue
    if ($tr.jobComplete) {
        Write-Host "   → county_stats rows: $($tr.rows[0].f[0].v)" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "   → county_stats table not found (BigQuery API works but table may not exist yet)" -ForegroundColor DarkYellow
}


# ── 13. Cloud Run ──────────────────────────────────────────────
Test-Service "13. Cloud Run" {
    $raw = gcloud run services list `
               --project $GCP_PROJECT `
               --platform managed `
               --format "value(metadata.name,status.url)" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud error: $raw" }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        "API reachable — no Cloud Run services deployed yet"
    } else {
        "Services: $($raw -join '  |  ')"
    }
} -Expect "List of service names + URLs, or empty (empty = API accessible)"


# ── 14. Cloud Functions ────────────────────────────────────────
Test-Service "14. Cloud Functions" {
    $raw = gcloud functions list `
               --project $GCP_PROJECT `
               --format "value(name,status)" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud error: $raw" }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        "API reachable — no Cloud Functions deployed yet"
    } else {
        "Functions: $($raw -join '  |  ')"
    }
} -Expect "List of function names + status, or empty"


# ── 15. Firestore ──────────────────────────────────────────────
Test-Service "15. Firestore" {
    # Use gcloud access token (API key rejected by Firestore security rules)
    $gcToken = (gcloud auth print-access-token 2>&1).Trim()
    if ($LASTEXITCODE -ne 0) { throw "gcloud token error: $gcToken" }

    $r = Invoke-RestMethod `
            -Uri "https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT/databases/(default)/documents/predictions?pageSize=3" `
            -Headers @{ Authorization = "Bearer $gcToken" } `
            -TimeoutSec 10

    $docCount = if ($r.documents) { $r.documents.Count } else { 0 }
    "Database accessible. Predictions collection has $docCount document(s) in first page."
} -Expect "HTTP 200 from Firestore REST API — documents array (empty = DB works, no data yet)"


# ── 16. Cloud Monitoring ───────────────────────────────────────
Test-Service "16. Cloud Monitoring" {
    $raw = gcloud monitoring dashboards list `
               --project $GCP_PROJECT `
               --format "value(displayName)" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud error: $raw" }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        "API reachable — no custom dashboards created yet"
    } else {
        "Dashboards: $($raw -join ', ')"
    }
} -Expect "List of dashboard names or empty (empty = API accessible)"


# ── 17. Cloud Logging ──────────────────────────────────────────
Test-Service "17. Cloud Logging" {
    $raw = gcloud logging logs list `
               --project $GCP_PROJECT `
               --format "value(name)" `
               --limit 5 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud error: $raw" }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        "API reachable — no log entries yet"
    } else {
        "Log streams (first 5): $($raw -join ', ')"
    }
} -Expect "List of log names (e.g. cloudaudit, run.googleapis.com) — non-empty means resources are logging"


# ── 18. Cloud Scheduler ────────────────────────────────────────
Test-Service "18. Cloud Scheduler" {
    # Cloud Scheduler requires a region; try a few common ones
    $regions = @("us-central1", "us-east1", "us-west1")
    $found = $false
    foreach ($loc in $regions) {
        $raw = gcloud scheduler jobs list `
                   --project $GCP_PROJECT `
                   --location $loc `
                   --format "value(name,schedule,state)" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $found = $true
            if ([string]::IsNullOrWhiteSpace($raw)) {
                return "API reachable in $loc — no scheduled jobs yet"
            } else {
                return "Jobs in $loc`: $($raw -join '  |  ')"
            }
        }
    }
    if (-not $found) { throw "Could not list scheduler jobs in any region — check gcloud auth" }
} -Expect "List of jobs or empty (empty = API accessible, no jobs scheduled)"


# ── 19. Cloud Build ────────────────────────────────────────────
Test-Service "19. Cloud Build" {
    $raw = gcloud builds list `
               --project $GCP_PROJECT `
               --limit 3 `
               --format "value(id,status,createTime)" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud error: $raw" }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        "API reachable — no builds triggered yet"
    } else {
        "Recent builds: $($raw -join '  |  ')"
    }
} -Expect "List of recent build IDs + status, or empty"


# ── 20. Secret Manager ─────────────────────────────────────────
Test-Service "20. Secret Manager" {
    $raw = gcloud secrets list `
               --project $GCP_PROJECT `
               --format "value(name,createTime)" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud error: $raw" }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        "API reachable — no secrets stored yet"
    } else {
        "Secrets: $($raw -join ', ')"
    }
} -Expect "List of secret names or empty (empty = API accessible, nothing stored yet)"


# ══════════════════════════════════════════════════════════════
#  SCORECARD
# ══════════════════════════════════════════════════════════════
Write-Host "`n" + ("═" * 55) -ForegroundColor White
Write-Host "  RESULTS  $($pass.Count)/20 services verified" -ForegroundColor White
Write-Host ("═" * 55) -ForegroundColor White

if ($pass.Count -gt 0) {
    Write-Host "`n✅ PASSED ($($pass.Count)):" -ForegroundColor Green
    $pass | ForEach-Object { Write-Host "   $_" -ForegroundColor Green }
}

if ($fail.Count -gt 0) {
    Write-Host "`n❌ FAILED ($($fail.Count)):" -ForegroundColor Red
    $fail | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }

    Write-Host "`n  Failure details:" -ForegroundColor DarkRed
    $detail | ForEach-Object { Write-Host "  • $_" -ForegroundColor DarkRed }

    Write-Host "`n  Common fixes:" -ForegroundColor Yellow
    Write-Host "  • AWS CLI failures   →  run: aws configure" -ForegroundColor DarkYellow
    Write-Host "  • gcloud failures    →  run: gcloud auth login && gcloud config set project cap-expt-492003" -ForegroundColor DarkYellow
    Write-Host "  • Lambda HTTP errors →  check Lambda function is deployed and URL is correct in .env.local" -ForegroundColor DarkYellow
    Write-Host "  • Firestore 403      →  Firebase API key may be restricted; check Firebase console → Project Settings → API key restrictions" -ForegroundColor DarkYellow
    Write-Host "  • BigQuery 403       →  API key needs BigQuery Data Viewer role; check GCP console → APIs & Services → Credentials" -ForegroundColor DarkYellow
}

Write-Host ""
