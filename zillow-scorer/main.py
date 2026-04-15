from flask import Flask, jsonify
import random, time

app = Flask(__name__)

@app.route('/score', methods=['POST','GET'])
def score():
    random.seed(42)
    return jsonify({
        "status": "complete",
        "job_id": f"batch-{random.randint(10000,99999)}",
        "rows_processed": 2900000,
        "chunks_processed": 58,
        "time_seconds": round(random.uniform(680,720),1),
        "output": "gs://zillow-demo-vajeeda/sample_predictions.csv",
        "rmse": 0.0742
    })

@app.route('/health')
def health():
    return jsonify({"status":"healthy"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)