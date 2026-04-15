"""
generate_sample_csv.py
======================
Generates a realistic 25-row sample_predictions.csv and optionally uploads it
to S3 so it's served through CloudFront.

Usage:
    # Generate CSV only (no upload)
    python generate_sample_csv.py

    # Generate + upload to S3
    python generate_sample_csv.py --upload

S3 bucket:   zillow-demo-vajeeda   (must already exist with public-read or
             CloudFront access)
CloudFront:  d3al9xtnn673r8.cloudfront.net/sample_predictions.csv

pip install boto3   (only needed for --upload)
"""

import csv
import random
import math
import sys
import os

OUTPUT_FILE = 'sample_predictions.csv'
S3_BUCKET   = 'zillow-demo-vajeeda'
S3_KEY      = 'sample_predictions.csv'
REGION      = 'us-east-1'
NUM_ROWS    = 25

COUNTY_PARAMS = [
    # (county_name,    county_te, weight)
    ('Los Angeles',    0.0142,  0.72),
    ('Orange County', -0.0089,  0.20),
    ('Ventura',        0.0031,  0.08),
]

# Real-looking parcel IDs from LA/OC/Ventura (format mirrors Zillow dataset)
BASE_PARCEL_IDS = [
    10754147, 10759547, 10769585, 10776953, 10786030,
    10798412, 10812345, 10823671, 10834902, 10845123,
    10856789, 10867034, 10878456, 10889012, 10890345,
    10901234, 10912567, 10923890, 10934012, 10945678,
    10956901, 10967234, 10978567, 10989890, 11000123,
]

CLUSTER_COUNTY = {
    'Los Angeles':    [0, 2, 3, 5, 7, 9, 12, 14, 17, 19, 21],
    'Orange County':  [1, 4, 8, 11, 15, 18, 22],
    'Ventura':        [6, 10, 13, 16, 20, 23, 24],
}


def sample_county():
    r = random.random()
    cumul = 0.0
    for name, te, weight in COUNTY_PARAMS:
        cumul += weight
        if r < cumul:
            return name, te
    return COUNTY_PARAMS[0][0], COUNTY_PARAMS[0][1]


def generate_row(parcel_id: int, seed: int) -> dict:
    random.seed(seed)
    county, cte = sample_county()

    # Property characteristics
    year_built   = random.randint(1930, 2014)
    finished_sqft = random.randint(800, 4500)
    lot_sqft     = random.randint(3000, 20000)
    tax_value    = random.randint(180_000, 2_200_000)
    tax_amount   = round(tax_value * random.gauss(0.013, 0.002), 2)
    month        = random.randint(1, 12)

    # Engineered features
    age        = 2016 - year_built
    tr         = tax_amount / (tax_value + 1)
    lar        = finished_sqft / (lot_sqft + 1)
    noise      = (random.random() - 0.5) * 0.008
    le         = round(0.045 + tr * 1.82 + cte * 0.8 - age * 0.00015 + lar * 0.003 + noise, 4)

    conf_low   = round(le - 0.018, 4)
    conf_high  = round(le + 0.018, 4)

    cluster_id = random.choice(CLUSTER_COUNTY[county])

    risk = 'OVERPRICED' if le > 0.03 else ('UNDERPRICED' if le < -0.03 else 'FAIR')

    zestimate = round(tax_value * random.gauss(1.08, 0.12))

    return {
        'parcelid':       parcel_id,
        'county':         county,
        'year_built':     year_built,
        'finished_sqft':  finished_sqft,
        'lot_sqft':       lot_sqft,
        'tax_value':      tax_value,
        'tax_amount':     round(tax_amount, 2),
        'transaction_month': month,
        'tax_ratio':      round(tr, 5),
        'property_age':   age,
        'living_area_ratio': round(lar, 4),
        'geo_cluster':    cluster_id,
        'logerror':       f'{le:+.4f}',
        'confidence_low': f'{conf_low:+.4f}',
        'confidence_high':f'{conf_high:+.4f}',
        'risk':           risk,
        'zestimate':      zestimate,
    }


FIELDNAMES = [
    'parcelid', 'county', 'year_built', 'finished_sqft', 'lot_sqft',
    'tax_value', 'tax_amount', 'transaction_month',
    'tax_ratio', 'property_age', 'living_area_ratio', 'geo_cluster',
    'logerror', 'confidence_low', 'confidence_high', 'risk', 'zestimate',
]


def generate_csv() -> None:
    rows = [generate_row(BASE_PARCEL_IDS[i], seed=i * 13 + 7) for i in range(NUM_ROWS)]

    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {OUTPUT_FILE} ({NUM_ROWS} rows)")
    print("\nSample rows:")
    for row in rows[:5]:
        print(f"  {row['parcelid']}  {row['county']:15s}  "
              f"logerror={row['logerror']}  risk={row['risk']}")


def upload_to_s3() -> None:
    try:
        import boto3
    except ImportError:
        print("boto3 not installed (pip install boto3). Skipping upload.")
        return

    s3 = boto3.client('s3', region_name=REGION)

    print(f"\nUploading to s3://{S3_BUCKET}/{S3_KEY} …")
    try:
        s3.upload_file(
            OUTPUT_FILE,
            S3_BUCKET,
            S3_KEY,
            ExtraArgs={
                'ContentType':  'text/csv',
                'CacheControl': 'max-age=86400',
            }
        )
        print(f"Uploaded. CloudFront URL:")
        print(f"  https://d3al9xtnn673r8.cloudfront.net/{S3_KEY}")
        print("\nNote: CloudFront may cache old content for up to 24 h.")
        print("To invalidate immediately, run:")
        print("  aws cloudfront create-invalidation --distribution-id <YOUR_DIST_ID> "
              "--paths '/sample_predictions.csv'")
    except Exception as e:
        print(f"Upload failed: {e}")
        print("Check that the S3 bucket exists and your IAM role has s3:PutObject.")


if __name__ == '__main__':
    generate_csv()
    if '--upload' in sys.argv:
        upload_to_s3()
    else:
        print("\nRun with --upload to push to S3/CloudFront.")
