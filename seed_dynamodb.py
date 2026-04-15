"""
seed_dynamodb.py
================
Pre-seeds the DynamoDB `zillow-predictions` table with 500 realistic
historical prediction records spread across the past 6 months.

Run once:
    pip install boto3
    python seed_dynamodb.py

AWS credentials must be configured (aws configure, env vars, or IAM role).
Region: us-east-1
"""

import boto3
import uuid
import random
import math
from datetime import datetime, timedelta
from decimal import Decimal

TABLE_NAME  = 'zillow-predictions'
REGION      = 'us-east-1'
NUM_RECORDS = 500          # number of historical records to seed
DAYS_BACK   = 180          # spread records over the past 6 months

# Realistic county weights (mirrors dataset distribution)
COUNTIES = [
    ('Los Angeles',   0.72),
    ('Orange County', 0.20),
    ('Ventura',       0.08),
]

# County-level target encodings (from trained model)
COUNTY_TE = {
    'Los Angeles':   0.0142,
    'Orange County': -0.0089,
    'Ventura':       0.0031,
}

RISK_THRESHOLDS = (0.03, -0.03)   # OVERPRICED if > 0.03, UNDERPRICED if < -0.03


def sample_county() -> str:
    r = random.random()
    cumul = 0.0
    for county, weight in COUNTIES:
        cumul += weight
        if r < cumul:
            return county
    return 'Los Angeles'


def generate_logerror(county: str) -> float:
    """Generate a realistic logerror for a given county."""
    cte  = COUNTY_TE[county]
    # Tax ratio drawn from ~N(0.013, 0.004)
    tr   = max(0.005, random.gauss(0.013, 0.004))
    age  = random.randint(5, 80)
    lar  = random.gauss(0.28, 0.10)
    noise = random.gauss(0, 0.012)
    le = 0.045 + tr * 1.82 + cte * 0.8 - age * 0.00015 + lar * 0.003 + noise
    return round(le, 4)


def classify_risk(logerror: float) -> str:
    if logerror > RISK_THRESHOLDS[0]:
        return 'OVERPRICED'
    if logerror < RISK_THRESHOLDS[1]:
        return 'UNDERPRICED'
    return 'FAIR'


def random_timestamp(days_back: int) -> str:
    """Return an ISO8601 UTC timestamp within the past `days_back` days."""
    offset_seconds = random.randint(0, days_back * 86400)
    dt = datetime.utcnow() - timedelta(seconds=offset_seconds)
    return dt.isoformat()


def seed(dry_run: bool = False) -> None:
    print(f"Seeding {NUM_RECORDS} records into DynamoDB table '{TABLE_NAME}' ({REGION})")
    if dry_run:
        print("DRY RUN — no writes will happen")

    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table    = dynamodb.Table(TABLE_NAME)

    # DynamoDB batch_writer handles retries + chunking (max 25 items/batch)
    with table.batch_writer() as batch:
        for i in range(NUM_RECORDS):
            county   = sample_county()
            le       = generate_logerror(county)
            risk     = classify_risk(le)
            zestimate = random.randint(380_000, 1_800_000)

            item = {
                'predictionId': str(uuid.uuid4()),
                'timestamp':    random_timestamp(DAYS_BACK),
                'county':       county,
                'risk':         risk,
                'logerror':     str(le),           # stored as string (matches Lambda)
                'zestimate':    Decimal(str(zestimate)),
            }

            if dry_run:
                if i < 3:
                    print(' ', item)
            else:
                batch.put_item(Item=item)

            if (i + 1) % 50 == 0:
                print(f"  {i + 1}/{NUM_RECORDS} records written…")

    if not dry_run:
        # Verify count
        response = table.scan(Select='COUNT')
        total = response.get('Count', '?')
        print(f"\nDone. Table now has {total}+ items (scan may be approximate for large tables).")
    else:
        print("\nDry run complete.")


if __name__ == '__main__':
    import sys
    dry = '--dry' in sys.argv
    seed(dry_run=dry)
