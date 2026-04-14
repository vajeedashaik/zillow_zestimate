// ── County Statistics ────────────────────────────────────────────────────────
export interface CountyStat {
  county: string;
  code: 'LA' | 'Orange' | 'Ventura';
  meanLogerror: number;
  count: number;
  fips: string;
}

export const countyStats: CountyStat[] = [
  { county: 'Los Angeles', code: 'LA', meanLogerror: 0.0142, count: 2100000, fips: '6037' },
  { county: 'Orange', code: 'Orange', meanLogerror: -0.0089, count: 580000, fips: '6059' },
  { county: 'Ventura', code: 'Ventura', meanLogerror: 0.0031, count: 220000, fips: '6111' },
];

// ── Age Group Stats ──────────────────────────────────────────────────────────
export interface AgeGroupStat {
  bucket: string;
  meanLogerror: number;
}

export const ageGroupStats: AgeGroupStat[] = [
  { bucket: '0–20 yrs', meanLogerror: 0.021 },
  { bucket: '20–40 yrs', meanLogerror: 0.008 },
  { bucket: '40–60 yrs', meanLogerror: -0.004 },
  { bucket: '60+ yrs', meanLogerror: -0.019 },
];

// ── Model Journey ────────────────────────────────────────────────────────────
export interface ModelJourneyPoint {
  model: string;
  rmse: number;
  isEnsemble?: boolean;
}

export const modelJourney: ModelJourneyPoint[] = [
  { model: 'Ridge', rmse: 0.0791 },
  { model: 'ExtraTrees', rmse: 0.0763 },
  { model: 'XGBoost', rmse: 0.0754 },
  { model: 'CatBoost', rmse: 0.0751 },
  { model: 'LightGBM', rmse: 0.0749 },
  { model: 'Ensemble', rmse: 0.0742, isEnsemble: true },
];

// ── SHAP Waterfall (Pasadena Example) ───────────────────────────────────────
export interface WaterfallEntry {
  name: string;
  displayName: string;
  value: number;
  start: number;
  end: number;
  isBase?: boolean;
  isFinal?: boolean;
  isPositive?: boolean;
}

export const waterfallData: WaterfallEntry[] = [
  { name: 'base', displayName: 'Base Value', value: 0.0521, start: 0, end: 0.0521, isBase: true },
  { name: 'tax_ratio', displayName: 'tax_ratio', value: 0.0183, start: 0.0521, end: 0.0704, isPositive: true },
  { name: 'geo_cluster_te', displayName: 'geo_cluster_te', value: 0.0142, start: 0.0704, end: 0.0846, isPositive: true },
  { name: 'property_age', displayName: 'property_age', value: -0.0097, start: 0.0749, end: 0.0846, isPositive: false },
  { name: 'living_area_ratio', displayName: 'living_area_ratio', value: 0.0061, start: 0.0749, end: 0.0810, isPositive: true },
  { name: 'county_te', displayName: 'county_te', value: 0.0044, start: 0.0810, end: 0.0854, isPositive: true },
  { name: 'prediction', displayName: 'Prediction', value: 0.0854, start: 0, end: 0.0854, isFinal: true },
];

// ── Monitoring Data ──────────────────────────────────────────────────────────
export interface RmseWeeklyPoint {
  week: number;
  label: string;
  rmse: number;
}

export const monitoringWeeklyRmse: RmseWeeklyPoint[] = [
  { week: 1, label: 'Jan', rmse: 0.0742 },
  { week: 2, label: 'Feb', rmse: 0.0744 },
  { week: 3, label: 'Mar', rmse: 0.0741 },
  { week: 4, label: 'Apr', rmse: 0.0743 },
  { week: 5, label: 'May', rmse: 0.0742 },
  { week: 6, label: 'Jun', rmse: 0.0745 },
  { week: 7, label: 'Jul', rmse: 0.0743 },
  { week: 8, label: 'Aug', rmse: 0.0744 },
  { week: 9, label: 'Sep', rmse: 0.0770 },
  { week: 10, label: 'Oct', rmse: 0.0772 },
  { week: 11, label: 'Nov', rmse: 0.0744 },
  { week: 12, label: 'Dec', rmse: 0.0742 },
];

export interface AlertEntry {
  id: number;
  date: string;
  feature: string;
  driftType: string;
  severity: 'high' | 'medium' | 'low';
  status: 'Open' | 'Resolved';
  psi: number;
}

export const alertLog: AlertEntry[] = [
  { id: 1, date: '2016-10-15', feature: 'tax_ratio', driftType: 'Distribution Shift', severity: 'high', status: 'Open', psi: 0.24 },
  { id: 2, date: '2016-09-28', feature: 'geo_cluster_te', driftType: 'Mean Shift', severity: 'medium', status: 'Resolved', psi: 0.14 },
  { id: 3, date: '2016-08-10', feature: 'property_age', driftType: 'Variance Shift', severity: 'low', status: 'Resolved', psi: 0.09 },
  { id: 4, date: '2016-07-03', feature: 'county_te', driftType: 'Distribution Shift', severity: 'low', status: 'Resolved', psi: 0.07 },
  { id: 5, date: '2016-05-21', feature: 'living_area_ratio', driftType: 'Mean Shift', severity: 'medium', status: 'Resolved', psi: 0.11 },
];

// ── Model Comparison Table ───────────────────────────────────────────────────
export interface ModelResult {
  model: string;
  cvRmse: number;
  trainTime: string;
  notes: string;
  isEnsemble?: boolean;
}

export const modelResults: ModelResult[] = [
  { model: 'Ridge', cvRmse: 0.0791, trainTime: '< 1 min', notes: 'Baseline; strong L2 regularisation' },
  { model: 'ExtraTrees', cvRmse: 0.0763, trainTime: '~2 min', notes: 'Randomised splits reduce variance' },
  { model: 'XGBoost', cvRmse: 0.0754, trainTime: '~8 min', notes: 'GPU-accelerated gradient boosting' },
  { model: 'CatBoost', cvRmse: 0.0751, trainTime: '~10 min', notes: 'Native categorical feature handling' },
  { model: 'LightGBM', cvRmse: 0.0749, trainTime: '~6 min', notes: 'Bayesian-tuned (Optuna, 20 trials)' },
  { model: 'Ensemble Stack', cvRmse: 0.0742, trainTime: '~28 min', notes: 'OOF Ridge meta-model; best result', isEnsemble: true },
];

// ── Engineered Features ──────────────────────────────────────────────────────
export interface FeatureDefinition {
  name: string;
  formula: string;
  description: string;
  category: 'temporal' | 'financial' | 'spatial' | 'interaction';
}

export const engineeredFeatures: FeatureDefinition[] = [
  { name: 'property_age', formula: '2016 − yearbuilt', description: 'Age of property at time of transaction', category: 'temporal' },
  { name: 'tax_ratio', formula: 'taxamount / (taxvaluedollarcnt + 1)', description: 'Tax burden relative to assessed value', category: 'financial' },
  { name: 'structure_land_ratio', formula: 'structureTax / (landTax + 1)', description: 'Ratio of structure to land tax value', category: 'financial' },
  { name: 'living_area_ratio', formula: 'finishedSqFt / (lotSizeSqFt + 1)', description: 'Proportion of lot that is living space', category: 'financial' },
  { name: 'month_sin', formula: 'sin(2π × month / 12)', description: 'Cyclical encoding — sine component', category: 'temporal' },
  { name: 'month_cos', formula: 'cos(2π × month / 12)', description: 'Cyclical encoding — cosine component', category: 'temporal' },
  { name: 'geo_cluster', formula: 'KMeans(lat, lon, k=25)', description: '25 spatial clusters on normalised lat/lon', category: 'spatial' },
  { name: 'geo_cluster_density', formula: 'count(properties per cluster)', description: 'Property density within each spatial cluster', category: 'spatial' },
  { name: 'cluster_mean_tax', formula: 'mean(taxamount) per cluster', description: 'Average tax amount for the cluster', category: 'spatial' },
  { name: 'geo_cluster_te', formula: 'CV mean(logerror) per cluster', description: '5-fold CV target encoding — no leakage', category: 'spatial' },
  { name: 'county_te', formula: 'CV mean(logerror) per county', description: 'County-level target encoding', category: 'spatial' },
  { name: 'age_cluster_interaction', formula: 'property_age × geo_cluster', description: 'Interaction: age within spatial cluster', category: 'interaction' },
];

// ── Pipeline Steps ───────────────────────────────────────────────────────────
export interface PipelineStep {
  step: number;
  title: string;
  description: string;
  icon: string;
}

export const pipelineSteps: PipelineStep[] = [
  { step: 1, title: 'Data Loading', description: 'Load 2.9M property rows with dtype optimisation to reduce memory footprint', icon: 'database' },
  { step: 2, title: 'EDA + Outlier Clipping', description: 'Exploratory analysis + clip at p1/p99 to remove extreme outliers', icon: 'bar-chart' },
  { step: 3, title: 'Missing Value Handling', description: 'Drop >90% sparse columns; median/mode imputation for remaining', icon: 'filter' },
  { step: 4, title: 'Feature Engineering', description: 'Create 12 new features: tax ratios, age, area ratios, cyclical month', icon: 'cpu' },
  { step: 5, title: 'Spatial Features', description: 'KMeans k=25 on lat/lon → cluster IDs + cluster density', icon: 'map-pin' },
  { step: 6, title: 'Target Encoding', description: '5-fold cross-validated target encoding to prevent leakage', icon: 'lock' },
  { step: 7, title: 'Multicollinearity Reduction', description: 'Remove corr >0.95 pairs; drop VIF >20 features', icon: 'git-merge' },
  { step: 8, title: 'Baseline Models', description: 'Train Ridge regression + ExtraTrees as benchmarks', icon: 'zap' },
  { step: 9, title: 'Boosting Models', description: 'XGBoost, LightGBM, CatBoost with 5-fold CV', icon: 'trending-up' },
  { step: 10, title: 'Bayesian Tuning', description: 'Optuna (20 trials) for LightGBM hyperparameter search', icon: 'settings' },
  { step: 11, title: 'OOF Stacking', description: 'Base model OOF predictions → Ridge meta-model (no leakage)', icon: 'layers' },
  { step: 12, title: 'SHAP Explainability', description: 'XGBoost TreeExplainer for per-property feature attributions', icon: 'eye' },
];
