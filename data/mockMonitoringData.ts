/**
 * data/mockMonitoringData.ts
 *
 * Simulated monitoring data for the Zillow Zestimate model monitoring dashboard.
 * Reflects the stacked ensemble (XGBoost + LightGBM + CatBoost + Ridge meta)
 * trained to predict logerror = log(Zestimate) − log(SalePrice).
 *
 * Features monitored: tax_ratio, geo_cluster_te, living_area_ratio, property_age, county_te
 * Baseline CV RMSE: 0.0742  |  Alert threshold: 0.08
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RmseDataPoint {
  week: string;   // "W01", "W02", …
  rmse: number;
  threshold: number;
}

export interface HistBin {
  bin: string;
  baseline: number;
  current: number;
}

export interface FeatureDrift {
  name: string;
  label: string;
  psi: number;
  psiDrifted: number;   // PSI after "simulate drift" event
  bins: HistBin[];
  binsDrifted: HistBin[]; // bins after "simulate drift" event
  unit?: string;
}

export interface LogerrorBin {
  bin: string;
  baseline: number;
  current: number;
}

export interface VolumeDataPoint {
  date: string;   // "Apr 01", …
  predictions: number;
  ma7: number;
}

export interface AlertEntry {
  id: number;
  date: string;
  feature: string;
  driftType: string;
  severity: 'low' | 'medium' | 'high';
  status: 'resolved' | 'open';
  psi: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Rolling weekly RMSE (52 weeks · Jan → Dec)
// ─────────────────────────────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildRmseData(): RmseDataPoint[] {
  const rng = seededRng(42);
  const data: RmseDataPoint[] = [];
  for (let w = 1; w <= 52; w++) {
    // Gentle upward drift starting around week 36, spike near week 44-48
    const trend = w < 36 ? 0 : (w - 36) * 0.00025;
    const spike = w >= 44 && w <= 48 ? 0.006 + rng() * 0.003 : 0;
    const noise = (rng() - 0.5) * 0.004;
    const rmse = parseFloat((0.0742 + trend + spike + noise).toFixed(4));
    data.push({
      week: `W${String(w).padStart(2, '0')}`,
      rmse,
      threshold: 0.08,
    });
  }
  return data;
}

export const RMSE_DATA: RmseDataPoint[] = buildRmseData();

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Feature drift distributions (baseline vs current month)
// ─────────────────────────────────────────────────────────────────────────────

function normalBins(
  mean: number, std: number, bins: number, scale: number, rng: () => number
): number[] {
  return Array.from({ length: bins }, (_, i) => {
    const z = (i / bins - 0.5) * 4;
    const pdf = Math.exp(-0.5 * ((z - (mean - 2) / std) ** 2)) / std;
    return parseFloat(Math.max(0, pdf * scale + (rng() - 0.5) * 0.3).toFixed(3));
  });
}

function buildTaxRatioBins(drifted = false): HistBin[] {
  const rng = seededRng(101);
  const labels = ['0.008','0.009','0.010','0.011','0.012','0.013','0.014','0.015','0.016','0.017','0.018','0.019','0.020'];
  const baseline = [0.5, 1.2, 2.8, 5.4, 9.1, 13.2, 16.0, 14.8, 12.1, 9.3, 6.4, 4.1, 2.3];
  const current  = drifted
    ? [0.3, 0.7, 1.8, 3.9, 7.2, 10.5, 14.1, 15.9, 14.2, 11.8, 9.3, 6.8, 4.5] // shifted right = drift
    : [0.4, 1.0, 2.5, 5.0, 8.8, 12.9, 15.6, 14.5, 12.5, 9.8, 6.9, 4.6, 2.8];
  return labels.map((bin, i) => ({
    bin,
    baseline: baseline[i],
    current: parseFloat((current[i] + (rng() - 0.5) * 0.3).toFixed(2)),
  }));
}

function buildGeoClusterBins(): HistBin[] {
  const rng = seededRng(202);
  const labels = ['-0.06','-0.05','-0.04','-0.03','-0.02','-0.01','0.00','0.01','0.02','0.03','0.04','0.05'];
  const baseline = [1.2, 2.4, 4.8, 9.2, 15.1, 18.3, 17.8, 13.9, 9.4, 5.2, 2.4, 1.1];
  const current  = [1.0, 2.0, 4.2, 8.5, 14.2, 17.9, 18.6, 14.8, 10.1, 5.8, 2.8, 1.4];
  return labels.map((bin, i) => ({
    bin,
    baseline: baseline[i],
    current: parseFloat((current[i] + (rng() - 0.5) * 0.25).toFixed(2)),
  }));
}

function buildLivingAreaBins(): HistBin[] {
  const rng = seededRng(303);
  const labels = ['0.05','0.10','0.15','0.20','0.25','0.30','0.35','0.40','0.45','0.50','0.55','0.60'];
  const baseline = [3.2, 7.4, 12.8, 16.9, 18.2, 16.4, 12.3, 8.1, 5.2, 3.1, 1.8, 0.9];
  const current  = [3.0, 7.1, 12.4, 16.7, 18.5, 16.8, 12.6, 8.3, 5.0, 3.0, 1.7, 0.8];
  return labels.map((bin, i) => ({
    bin,
    baseline: baseline[i],
    current: parseFloat((current[i] + (rng() - 0.5) * 0.2).toFixed(2)),
  }));
}

function buildPropertyAgeBins(): HistBin[] {
  const rng = seededRng(404);
  const labels = ['0-10','11-20','21-30','31-40','41-50','51-60','61-70','71-80','81-90','91-100'];
  const baseline = [8.2, 11.4, 13.6, 14.8, 16.1, 15.3, 10.2, 6.4, 3.1, 1.2];
  const current  = [8.5, 11.8, 13.2, 14.6, 15.9, 15.1, 10.5, 6.6, 3.2, 1.1];
  return labels.map((bin, i) => ({
    bin,
    baseline: baseline[i],
    current: parseFloat((current[i] + (rng() - 0.5) * 0.3).toFixed(2)),
  }));
}

function buildCountyTeBins(): HistBin[] {
  const rng = seededRng(505);
  const labels = ['-0.04','-0.03','-0.02','-0.01','0.00','0.01','0.02','0.03','0.04','0.05'];
  const baseline = [2.1, 5.8, 12.4, 19.2, 22.6, 18.8, 11.3, 5.4, 2.0, 0.7];
  const current  = [2.0, 5.6, 12.1, 19.0, 22.9, 19.2, 11.5, 5.5, 1.9, 0.6];
  return labels.map((bin, i) => ({
    bin,
    baseline: baseline[i],
    current: parseFloat((current[i] + (rng() - 0.5) * 0.2).toFixed(2)),
  }));
}

export const FEATURE_DRIFT: FeatureDrift[] = [
  {
    name: 'tax_ratio',
    label: 'Tax Ratio',
    psi: 0.09,
    psiDrifted: 0.31,
    bins: buildTaxRatioBins(false),
    binsDrifted: buildTaxRatioBins(true),
    unit: 'tax_amt / tax_val',
  },
  {
    name: 'geo_cluster_te',
    label: 'Geo Cluster TE',
    psi: 0.14,
    psiDrifted: 0.17,
    bins: buildGeoClusterBins(),
    binsDrifted: buildGeoClusterBins(),
    unit: 'target-encoded',
  },
  {
    name: 'living_area_ratio',
    label: 'Living Area Ratio',
    psi: 0.04,
    psiDrifted: 0.05,
    bins: buildLivingAreaBins(),
    binsDrifted: buildLivingAreaBins(),
    unit: 'sqft / lot_sqft',
  },
  {
    name: 'property_age',
    label: 'Property Age',
    psi: 0.03,
    psiDrifted: 0.04,
    bins: buildPropertyAgeBins(),
    binsDrifted: buildPropertyAgeBins(),
    unit: 'years',
  },
  {
    name: 'county_te',
    label: 'County TE',
    psi: 0.02,
    psiDrifted: 0.03,
    bins: buildCountyTeBins(),
    binsDrifted: buildCountyTeBins(),
    unit: 'target-encoded',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3 · logerror distribution (baseline vs current)
// ─────────────────────────────────────────────────────────────────────────────

export interface LogErrorBin {
  bin: string;
  baseline: number;
  current: number;
}

export const LOGERROR_DIST: LogErrorBin[] = (() => {
  const rng = seededRng(999);
  const edges = Array.from({ length: 24 }, (_, i) => -0.38 + i * 0.034);
  return edges.map((v, i) => {
    const z = (v + 0.017) / 0.08; // center near 0.017 (slight positive bias)
    const baseline = parseFloat(
      Math.max(0, (Math.exp(-0.5 * z * z) / (0.08 * Math.sqrt(2 * Math.PI))) * 0.034 * 100 + (rng() - 0.5) * 0.5).toFixed(2)
    );
    // Current slightly shifted right (model degrading on overestimates)
    const zC = (v + 0.017 - 0.025) / 0.09;
    const current = parseFloat(
      Math.max(0, (Math.exp(-0.5 * zC * zC) / (0.09 * Math.sqrt(2 * Math.PI))) * 0.034 * 100 + (rng() - 0.5) * 0.5).toFixed(2)
    );
    return { bin: v.toFixed(3), baseline, current };
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Daily prediction volume (30 days)
// ─────────────────────────────────────────────────────────────────────────────

export const VOLUME_DATA: VolumeDataPoint[] = (() => {
  const rng = seededRng(7777);
  const months = ['Mar','Apr'];
  const days: { date: string; predictions: number }[] = [];

  // Mar 15 → Apr 13 (30 days)
  for (let d = 0; d < 30; d++) {
    const dayOfMonth = d < 17 ? d + 15 : d - 16;
    const month = d < 17 ? 'Mar' : 'Apr';
    const dayOfWeek = (d + 1) % 7; // 0 = Sun
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 620 : 1050;
    const noise = Math.floor((rng() - 0.5) * 300);
    days.push({
      date: `${month} ${String(dayOfMonth).padStart(2, '0')}`,
      predictions: Math.max(200, base + noise),
    });
  }

  // Compute 7-day moving average
  return days.map((d, i) => {
    const window = days.slice(Math.max(0, i - 6), i + 1);
    const ma7 = parseFloat(
      (window.reduce((s, x) => s + x.predictions, 0) / window.length).toFixed(0)
    );
    return { ...d, ma7 };
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Alert log
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_ALERTS: AlertEntry[] = [
  { id: 1, date: '2024-01-08', feature: 'tax_ratio',        driftType: 'PSI Spike',         severity: 'high',   status: 'resolved', psi: 0.28 },
  { id: 2, date: '2024-02-14', feature: 'geo_cluster_te',   driftType: 'Distribution Shift', severity: 'medium', status: 'resolved', psi: 0.19 },
  { id: 3, date: '2024-03-22', feature: 'living_area_ratio',driftType: 'Mean Shift',         severity: 'low',    status: 'resolved', psi: 0.11 },
  { id: 4, date: '2024-05-03', feature: 'tax_ratio',        driftType: 'PSI Spike',         severity: 'high',   status: 'resolved', psi: 0.34 },
  { id: 5, date: '2024-06-17', feature: 'property_age',     driftType: 'Variance Change',    severity: 'low',    status: 'resolved', psi: 0.13 },
  { id: 6, date: '2024-08-09', feature: 'geo_cluster_te',   driftType: 'Distribution Shift', severity: 'medium', status: 'resolved', psi: 0.22 },
  { id: 7, date: '2024-10-30', feature: 'county_te',        driftType: 'Mean Shift',         severity: 'low',    status: 'resolved', psi: 0.15 },
  { id: 8, date: '2025-01-18', feature: 'geo_cluster_te',   driftType: 'Distribution Shift', severity: 'medium', status: 'open',     psi: 0.16 },
];

export const SIMULATED_DRIFT_ALERT: AlertEntry = {
  id: 9,
  date: new Date().toISOString().split('T')[0],
  feature: 'tax_ratio',
  driftType: 'PSI Spike (Simulated)',
  severity: 'high',
  status: 'open',
  psi: 0.31,
};

// ─────────────────────────────────────────────────────────────────────────────
// 6 · Overview stats
// ─────────────────────────────────────────────────────────────────────────────

export const OVERVIEW = {
  currentRmse:    0.0761,
  baselineRmse:   0.0742,
  alertThreshold: 0.08,
  driftStatus:    'OK' as 'OK' | 'Warning' | 'Alert',
  totalPredictions: 284_419,
  uptimeDays:     412,
  modelVersion:   'v2.3.1',
  lastRetrained:  '2024-09-15',
};

export const DRIFTED_OVERVIEW = {
  ...OVERVIEW,
  currentRmse:  0.0819,
  driftStatus:  'Alert' as const,
};
