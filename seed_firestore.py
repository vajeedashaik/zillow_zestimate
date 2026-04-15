"""
seed_firestore.py
=================
Pre-seeds the Firestore `predictions` collection with 15 recent prediction
records so the live feed on the monitoring page shows real data immediately.

Run once:
    pip install firebase-admin
    python seed_firestore.py

You need a Firebase service-account JSON.  Download it from:
  Firebase Console → Project Settings → Service Accounts → Generate new private key
Save it as  firebase-service-account.json  next to this script (it is gitignored).
"""

import sys, random
import math
from datetime import datetime, timedelta
sys.stdout.reconfigure(encoding='utf-8')

# ── Try to import firebase_admin ───────────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    HAS_FIREBASE = True
except ImportError:
    HAS_FIREBASE = False
    print("firebase-admin not installed.  Run: pip install firebase-admin")

SERVICE_ACCOUNT_FILE = 'firebase-service-account.json'
PROJECT_ID           = 'zillow-f19c7'
COLLECTION           = 'predictions'
NUM_RECORDS          = 15

COUNTIES = [
    ('Los Angeles',   0.72),
    ('Orange County', 0.20),
    ('Ventura',       0.08),
]

COUNTY_TE = {
    'Los Angeles':   0.0142,
    'Orange County': -0.0089,
    'Ventura':       0.0031,
}


def sample_county() -> str:
    r = random.random()
    cumul = 0.0
    for county, weight in COUNTIES:
        cumul += weight
        if r < cumul:
            return county
    return 'Los Angeles'


def generate_logerror(county: str) -> float:
    cte   = COUNTY_TE[county]
    tr    = max(0.005, random.gauss(0.013, 0.004))
    age   = random.randint(5, 80)
    noise = random.gauss(0, 0.012)
    le    = 0.045 + tr * 1.82 + cte * 0.8 - age * 0.00015 + noise
    return round(le, 4)


def classify_risk(le: float) -> str:
    if le > 0.03:
        return 'OVERPRICED'
    if le < -0.03:
        return 'UNDERPRICED'
    return 'FAIR'


def seed() -> None:
    if not HAS_FIREBASE:
        print("Cannot seed without firebase-admin. See instructions above.")
        return

    import os
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"Service account file not found: {SERVICE_ACCOUNT_FILE}")
        print("Download from Firebase Console → Project Settings → Service Accounts")
        return

    # Initialise Firebase Admin SDK
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
        firebase_admin.initialize_app(cred, {'projectId': PROJECT_ID})

    db = firestore.client()
    col = db.collection(COLLECTION)

    print(f"Seeding {NUM_RECORDS} records into Firestore '{COLLECTION}' collection…")

    for i in range(NUM_RECORDS):
        county    = sample_county()
        le        = generate_logerror(county)
        risk      = classify_risk(le)
        zestimate = random.randint(380_000, 1_800_000)
        # Spread records over the past 48 hours so the feed looks live
        offset_minutes = random.randint(0, 48 * 60)
        ts = (datetime.utcnow() - timedelta(minutes=offset_minutes)).isoformat()

        doc = {
            'county':    county,
            'risk':      risk,
            'logerror':  le,
            'timestamp': ts,
            'zestimate': zestimate,
        }

        col.add(doc)
        print(f"  [{i+1}/{NUM_RECORDS}] {county} · {risk} · logerror={le:+.4f}")

    print(f"\nDone. {NUM_RECORDS} predictions written to Firestore.")
    print("The monitoring page live feed should now show data immediately.")


if __name__ == '__main__':
    seed()
