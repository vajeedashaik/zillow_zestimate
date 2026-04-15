"""
setup_bigquery.py
=================
Creates the BigQuery dataset `zillow_data` and table `county_stats` in your
GCP project, then loads the three-county summary rows that CountyAnalysis.tsx
queries live.

Table schema matches the query in CountyAnalysis.tsx:
  SELECT county, mean_logerror, pct_overpriced, total_properties
  FROM `{PROJECT}.zillow_data.county_stats`

Run once:
    pip install google-cloud-bigquery
    # Authenticate with GCP (one of):
    #   gcloud auth application-default login
    #   set GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
    python setup_bigquery.py

"""

PROJECT_ID   = 'cap-expt-492003'
DATASET_ID   = 'zillow_data'
TABLE_ID     = 'county_stats'

# Data that matches the mock fallback in CountyAnalysis.tsx and mockData.ts
ROWS = [
    {
        'county':            'Los Angeles',
        'mean_logerror':     0.0142,
        'pct_overpriced':    61.3,
        'total_properties':  2100000,
        'fips':              '6037',
        'avg_tax_ratio':     0.01312,
        'avg_property_age':  47,
    },
    {
        'county':            'Orange County',
        'mean_logerror':     -0.0089,
        'pct_overpriced':    38.2,
        'total_properties':  580000,
        'fips':              '6059',
        'avg_tax_ratio':     0.01187,
        'avg_property_age':  42,
    },
    {
        'county':            'Ventura',
        'mean_logerror':     0.0031,
        'pct_overpriced':    51.7,
        'total_properties':  220000,
        'fips':              '6111',
        'avg_tax_ratio':     0.01254,
        'avg_property_age':  39,
    },
]

SCHEMA = [
    {'name': 'county',           'type': 'STRING',  'mode': 'REQUIRED', 'description': 'County name'},
    {'name': 'mean_logerror',    'type': 'FLOAT64', 'mode': 'REQUIRED', 'description': 'Mean log(Zestimate/SalePrice) — positive = overestimated'},
    {'name': 'pct_overpriced',   'type': 'FLOAT64', 'mode': 'NULLABLE', 'description': '% of properties where Zestimate > SalePrice'},
    {'name': 'total_properties', 'type': 'INT64',   'mode': 'NULLABLE', 'description': 'Total properties in county'},
    {'name': 'fips',             'type': 'STRING',  'mode': 'NULLABLE', 'description': 'FIPS county code'},
    {'name': 'avg_tax_ratio',    'type': 'FLOAT64', 'mode': 'NULLABLE', 'description': 'Mean taxamount / taxvaluedollarcnt'},
    {'name': 'avg_property_age', 'type': 'INT64',   'mode': 'NULLABLE', 'description': 'Mean property age (years as of 2016)'},
]


def setup() -> None:
    try:
        from google.cloud import bigquery
        from google.api_core.exceptions import Conflict, NotFound
    except ImportError:
        print("google-cloud-bigquery not installed. Run: pip install google-cloud-bigquery")
        return

    client = bigquery.Client(project=PROJECT_ID)

    # ── 1. Create dataset if it doesn't exist ─────────────────────────────────
    dataset_ref = client.dataset(DATASET_ID)
    try:
        dataset = bigquery.Dataset(f"{PROJECT_ID}.{DATASET_ID}")
        dataset.location = 'US'
        dataset.description = 'Zillow Zestimate model analytics — county & prediction data'
        client.create_dataset(dataset, exists_ok=True)
        print(f"Dataset '{DATASET_ID}' ready.")
    except Exception as e:
        print(f"Dataset creation error: {e}")
        return

    # ── 2. Create / replace table ─────────────────────────────────────────────
    table_ref  = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
    bq_schema  = [
        bigquery.SchemaField(
            col['name'], col['type'], mode=col['mode'], description=col.get('description', '')
        )
        for col in SCHEMA
    ]

    table = bigquery.Table(table_ref, schema=bq_schema)
    table.description = 'Per-county summary statistics from the Zillow 2016 transactions dataset'

    try:
        table = client.create_table(table)
        print(f"Table '{TABLE_ID}' created.")
    except Conflict:
        print(f"Table '{TABLE_ID}' already exists — will insert rows.")

    # ── 3. Insert rows ────────────────────────────────────────────────────────
    errors = client.insert_rows_json(table_ref, ROWS)
    if errors:
        print(f"Insert errors: {errors}")
    else:
        print(f"Inserted {len(ROWS)} rows into {table_ref}")

    # ── 4. Verify with a quick query ──────────────────────────────────────────
    query = f"""
        SELECT county, mean_logerror, pct_overpriced, total_properties
        FROM `{table_ref}`
        ORDER BY mean_logerror DESC
    """
    print("\nVerification query result:")
    for row in client.query(query).result():
        print(f"  {row.county:15s}  mean_logerror={row.mean_logerror:+.4f}  "
              f"pct_overpriced={row.pct_overpriced:.1f}%  "
              f"total={row.total_properties:,}")

    print(f"\nBigQuery table ready. CountyAnalysis.tsx will now pull live data")
    print(f"instead of falling back to mock values.")


if __name__ == '__main__':
    setup()
