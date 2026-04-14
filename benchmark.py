"""
benchmark.py
------------
Benchmarks the full 2.9M-row batch scoring run and the lookup module.

What it measures
----------------
1. Full pipeline timing (batch_scorer.run_batch_scoring) across configurable
   chunk sizes — reports wall time, throughput, and peak RAM.
2. Lookup latency — single-parcel and batch lookups after predictions exist.
3. Writes a JSON report to benchmark_results.json.

Usage
-----
    # Run the full scoring benchmark (re-scores if needed)
    python benchmark.py --mode full

    # Benchmark only lookups (requires predictions/ to exist already)
    python benchmark.py --mode lookup

    # Both
    python benchmark.py --mode all
    python benchmark.py  # defaults to --mode all
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import psutil

sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ── Helper: process RSS ───────────────────────────────────────────────────────

def _rss_mb() -> float:
    return psutil.Process(os.getpid()).memory_info().rss / 1_048_576


# ── Benchmark 1: full pipeline ────────────────────────────────────────────────

def benchmark_scoring(
    input_path: str,
    output_dir: str,
    chunk_sizes: List[int],
    models_dir: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Run run_batch_scoring() for each chunk size and record timing.

    Only the *first* run actually writes output; subsequent runs reuse the
    same output_dir so we focus purely on scoring speed, not I/O.
    """
    from batch_scorer import run_batch_scoring

    if not Path(input_path).exists():
        logger.error("Input file not found: %s", input_path)
        logger.error("Skipping scoring benchmark.")
        return []

    results = []
    for cs in chunk_sizes:
        logger.info("─" * 60)
        logger.info("Benchmarking chunk_size=%d …", cs)
        ram_before = _rss_mb()
        t0 = time.perf_counter()

        written = run_batch_scoring(
            input_path=input_path,
            output_dir=output_dir,
            chunk_size=cs,
            models_dir=models_dir,
        )

        elapsed = time.perf_counter() - t0
        ram_after = _rss_mb()

        # Read the run_metadata.json written by batch_scorer for detailed stats
        meta_path = Path(output_dir) / "run_metadata.json"
        extra: Dict[str, Any] = {}
        if meta_path.exists():
            with open(meta_path) as f:
                extra = json.load(f)

        row: Dict[str, Any] = {
            "chunk_size":            cs,
            "wall_time_s":           round(elapsed, 2),
            "total_scored":          extra.get("total_scored", "?"),
            "skipped_rows":          extra.get("skipped_rows", "?"),
            "throughput_rows_per_s": extra.get("throughput_rows_per_s", "?"),
            "avg_chunk_s":           extra.get("avg_chunk_s", "?"),
            "peak_ram_mib":          round(max(ram_before, ram_after), 1),
            "parquet_files":         list(written.values()),
        }
        results.append(row)

        logger.info("  chunk=%d  |  %.1f s  |  %.0f rows/s  |  %.0f MiB RAM",
                    cs,
                    elapsed,
                    extra.get("throughput_rows_per_s", 0),
                    row["peak_ram_mib"])

    return results


# ── Benchmark 2: lookup latency ───────────────────────────────────────────────

def benchmark_lookup(
    predictions_dir: str,
    n_single: int = 1000,
    batch_sizes: List[int] | None = None,
) -> Dict[str, Any]:
    """
    Measure single-parcel and batch lookup latencies.

    Parameters
    ----------
    predictions_dir : str
        Directory that holds fips_*.parquet files.
    n_single : int
        Number of random single-parcel lookups to time.
    batch_sizes : list of int
        Batch sizes to test for lookup_batch().
    """
    if batch_sizes is None:
        batch_sizes = [10, 100, 1_000, 10_000]

    from lookup import (
        set_predictions_dir,
        load_predictions,
        get_cluster_stats,
        lookup_batch,
        _ensure_loaded,
        _predictions_df,
    )

    set_predictions_dir(predictions_dir)

    # Force load and measure cold-start time
    t_load = time.perf_counter()
    _ensure_loaded()
    load_time = time.perf_counter() - t_load

    # Re-import after ensure_loaded to get the populated module-level df
    import lookup as _lk
    df = _lk._predictions_df

    if df is None or df.empty:
        logger.error("No predictions loaded — run batch_scorer.py first.")
        return {}

    total_props = len(df)
    sample_pids = df["parcelid"].sample(
        min(n_single, total_props), random_state=42
    ).tolist()

    # ── Single-parcel lookup ──────────────────────────────────────────────────
    times_single = []
    errors_single = 0
    for pid in sample_pids:
        t0 = time.perf_counter()
        try:
            load_predictions(pid)
        except KeyError:
            errors_single += 1
        times_single.append(time.perf_counter() - t0)

    p50  = float(np.percentile(times_single, 50))  * 1000  # → ms
    p95  = float(np.percentile(times_single, 95))  * 1000
    p99  = float(np.percentile(times_single, 99))  * 1000
    mean = float(np.mean(times_single))             * 1000

    logger.info("Single-parcel lookup  (n=%d):  mean=%.3f ms  p50=%.3f ms  p95=%.3f ms  p99=%.3f ms",
                n_single, mean, p50, p95, p99)

    # ── Cluster stats lookup ──────────────────────────────────────────────────
    clusters = df["geo_cluster"].unique().tolist()
    times_cluster = []
    for cid in clusters:
        t0 = time.perf_counter()
        try:
            get_cluster_stats(int(cid))
        except KeyError:
            pass
        times_cluster.append(time.perf_counter() - t0)

    cluster_mean_ms = float(np.mean(times_cluster)) * 1000
    logger.info("Cluster stats lookup  (n=%d):  mean=%.3f ms", len(clusters), cluster_mean_ms)

    # ── Batch lookup ──────────────────────────────────────────────────────────
    batch_results = []
    for bsz in batch_sizes:
        actual_bsz = min(bsz, total_props)
        batch_pids = df["parcelid"].sample(actual_bsz, random_state=7).tolist()

        times_b = []
        for _ in range(5):    # 5 reps for stability
            t0 = time.perf_counter()
            lookup_batch(batch_pids)
            times_b.append(time.perf_counter() - t0)

        median_ms = float(np.median(times_b)) * 1000
        throughput = actual_bsz / (float(np.median(times_b)) + 1e-12)
        logger.info("  Batch lookup n=%6d:  median=%.2f ms  (%.0f lookups/s)",
                    actual_bsz, median_ms, throughput)
        batch_results.append({
            "batch_size":      actual_bsz,
            "median_ms":       round(median_ms, 3),
            "throughput_per_s": round(throughput, 1),
        })

    return {
        "cold_load_time_s":       round(load_time, 2),
        "total_predictions":      total_props,
        "single_lookup_n":        n_single,
        "single_lookup_errors":   errors_single,
        "single_lookup_mean_ms":  round(mean, 4),
        "single_lookup_p50_ms":   round(p50, 4),
        "single_lookup_p95_ms":   round(p95, 4),
        "single_lookup_p99_ms":   round(p99, 4),
        "cluster_lookup_mean_ms": round(cluster_mean_ms, 4),
        "batch_lookup":           batch_results,
    }


# ── Report writer ─────────────────────────────────────────────────────────────

def write_report(scoring_results: list, lookup_results: dict, out_path: str) -> None:
    report = {
        "scoring_benchmark": scoring_results,
        "lookup_benchmark":  lookup_results,
    }
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    logger.info("Benchmark report written to %s", out_path)


# ── CLI ───────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Zillow batch scoring benchmark")
    p.add_argument("--mode",            default="all",
                   choices=["full", "lookup", "all"],
                   help="Which benchmark to run (default: all)")
    p.add_argument("--input",           default="properties_2016.csv",
                   help="Path to properties_2016.csv")
    p.add_argument("--output-dir",      default="predictions",
                   help="Directory for Parquet output / lookup source")
    p.add_argument("--models-dir",      default=None,
                   help="Override path to models/ directory")
    p.add_argument("--chunk-sizes",     default="50000",
                   help="Comma-separated chunk sizes to test (default: 50000)")
    p.add_argument("--single-lookups",  type=int, default=1000,
                   help="Number of single-parcel lookups to benchmark (default: 1000)")
    p.add_argument("--report-path",     default="benchmark_results.json",
                   help="Output path for JSON report")
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    chunk_sizes = [int(x.strip()) for x in args.chunk_sizes.split(",")]

    scoring_results: list = []
    lookup_results: dict  = {}

    if args.mode in ("full", "all"):
        logger.info("=" * 70)
        logger.info("BENCHMARK: Full Scoring Pipeline")
        logger.info("=" * 70)
        scoring_results = benchmark_scoring(
            input_path=args.input,
            output_dir=args.output_dir,
            chunk_sizes=chunk_sizes,
            models_dir=args.models_dir,
        )

    if args.mode in ("lookup", "all"):
        logger.info("=" * 70)
        logger.info("BENCHMARK: Lookup Latency")
        logger.info("=" * 70)
        lookup_results = benchmark_lookup(
            predictions_dir=args.output_dir,
            n_single=args.single_lookups,
        )

    write_report(scoring_results, lookup_results, args.report_path)

    # ── Console summary ───────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("BENCHMARK SUMMARY")
    print("=" * 70)

    if scoring_results:
        print("\nScoring Pipeline:")
        for r in scoring_results:
            print(f"  chunk={r['chunk_size']:>6}  |  "
                  f"{r['wall_time_s']:.1f}s  |  "
                  f"{r['throughput_rows_per_s']:>8.0f} rows/s  |  "
                  f"{r['peak_ram_mib']:.0f} MiB RAM")

    if lookup_results:
        print(f"\nLookup Latency ({lookup_results.get('total_predictions', '?'):,} predictions loaded):")
        print(f"  Cold load          : {lookup_results.get('cold_load_time_s', '?')} s")
        print(f"  Single lookup mean : {lookup_results.get('single_lookup_mean_ms', '?')} ms")
        print(f"  Single lookup p99  : {lookup_results.get('single_lookup_p99_ms', '?')} ms")
        print(f"  Cluster stats mean : {lookup_results.get('cluster_lookup_mean_ms', '?')} ms")
        bl = lookup_results.get("batch_lookup", [])
        if bl:
            print("  Batch lookup:")
            for b in bl:
                print(f"    n={b['batch_size']:>6}  {b['median_ms']:.2f} ms  "
                      f"({b['throughput_per_s']:.0f} lookups/s)")

    print(f"\nFull report: {args.report_path}")
    print("=" * 70)
