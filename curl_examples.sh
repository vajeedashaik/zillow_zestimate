#!/usr/bin/env bash
# curl_examples.sh – Test every endpoint of the Zillow Zestimate Predictor API
# Start the server first:
#   uvicorn main:app --reload --port 8000

BASE="http://localhost:8000"

echo "=== GET /health ==="
curl -s -X GET "$BASE/health" | python -m json.tool

echo ""
echo "=== GET /model/info ==="
curl -s -X GET "$BASE/model/info" | python -m json.tool

echo ""
echo "=== POST /predict (single property) ==="
curl -s -X POST "$BASE/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "taxamount": 8500.0,
    "taxvaluedollarcnt": 450000.0,
    "finishedsquarefeet12": 1800.0,
    "lotsizesquarefeet": 6000.0,
    "yearbuilt": 1985,
    "latitude": 34.052,
    "longitude": -118.243,
    "transactiondate": "2016-06-15",
    "fips": 6037,
    "calculatedfinishedsquarefeet": 1800.0,
    "structuretaxvaluedollarcnt": 280000.0,
    "landtaxvaluedollarcnt": 170000.0,
    "fullbathcnt": 2.0,
    "threequarterbathnbr": 0.0
  }' | python -m json.tool

echo ""
echo "=== POST /predict/batch (two properties) ==="
curl -s -X POST "$BASE/predict/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": [
      {
        "taxamount": 8500.0,
        "taxvaluedollarcnt": 450000.0,
        "finishedsquarefeet12": 1800.0,
        "lotsizesquarefeet": 6000.0,
        "yearbuilt": 1985,
        "latitude": 34.052,
        "longitude": -118.243,
        "transactiondate": "2016-06-15",
        "fips": 6037
      },
      {
        "taxamount": 12000.0,
        "taxvaluedollarcnt": 620000.0,
        "finishedsquarefeet12": 2400.0,
        "lotsizesquarefeet": 8500.0,
        "yearbuilt": 2001,
        "latitude": 33.787,
        "longitude": -117.853,
        "transactiondate": "2016-09-03",
        "fips": 6059
      }
    ]
  }' | python -m json.tool
