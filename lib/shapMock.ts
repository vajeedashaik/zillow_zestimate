/**
 * lib/shapMock.ts
 *
 * Client-side mock SHAP explainer for the Zillow Zestimate error predictor.
 *
 * Replicates the feature engineering pipeline from model.py / feature_engineering.py,
 * then applies calibrated sensitivity coefficients derived from the XGBoost
 * TreeExplainer results to produce realistic per-feature SHAP contributions.
 *
 * Feature importance order (from model.py SHAP summary plot):
 *   tax_ratio > geo_cluster_te > living_area_ratio > property_age >
 *   county_te > structure_land_ratio > geo_cluster_density > month_sin >
 *   age_cluster_interaction
 */

export type County = 'LA' | 'Orange' | 'Ventura';

export interface PropertyInput {
  yearBuilt: number;        // e.g. 1985
  finishedSqFt: number;     // calculatedfinishedsquarefeet
  lotSizeSqFt: number;      // lotsizesquarefeet
  taxAmount: number;        // taxamount (annual, $)
  taxValue: number;         // taxvaluedollarcnt ($)
  transactionMonth: number; // 1–12
  county: County;
}

export interface ShapFeature {
  feature: string;     // internal key
  label: string;       // display name
  rawValue: string;    // formatted engineered feature value
  shapValue: number;   // signed SHAP contribution to logerror
  description: string; // human-readable interpretation
}

export interface ShapResult {
  baseValue: number;         // E[f(x)] — mean logerror across training data
  prediction: number;        // final predicted logerror
  confidenceLow: number;
  confidenceHigh: number;
  features: ShapFeature[];   // sorted by |shapValue| descending
}

// ---------------------------------------------------------------------------
// County-level reference values
// (approximated from geo_cluster_means / county_means in model.py)
// ---------------------------------------------------------------------------

const COUNTY_TE: Record<County, number> = {
  LA:      0.0151,   // FIPS 6037 — slight over-estimation trend
  Orange:  0.0063,   // FIPS 6059 — most accurate county
  Ventura: 0.0198,   // FIPS 6111 — highest over-estimation
};

// Geo-cluster target-encoding is approximated as county_te ± neighbourhood noise
const COUNTY_CLUSTER_TE_NOISE: Record<County, number> = {
  LA:      0.004,
  Orange:  0.003,
  Ventura: 0.005,
};

// Geo-cluster density (properties per cluster, approximated)
const COUNTY_CLUSTER_DENSITY: Record<County, number> = {
  LA:      4200,
  Orange:  3100,
  Ventura: 1800,
};

// Approximate geo_cluster index per county (for age_cluster_interaction)
const COUNTY_CLUSTER_IDX: Record<County, number> = {
  LA:      12,
  Orange:  8,
  Ventura: 4,
};

// ---------------------------------------------------------------------------
// Training-data typical values (medians / means used during training)
// These anchor the deviation-based SHAP calculation.
// ---------------------------------------------------------------------------

const TYPICAL = {
  taxRatio:              0.01245,
  livingAreaRatio:       0.2810,
  propertyAge:           38,
  structureLandRatio:    1.462,
  monthSin:              0.051,   // slight positive mean due to mid-year sales peak
  geoClusterTe:          0.01255,
  countyTe:              0.01255,
  geoClusterDensity:     3200,
  ageClusterInteraction: 468,
};

// Sensitivity coefficients: SHAP ≈ coefficient × (feature − typical)
// Calibrated so that typical properties produce SHAP values near 0 and
// extreme properties produce contributions in the −0.04 … +0.05 range.
const SENSITIVITY = {
  taxRatio:              2.35,
  geoClusterTe:          1.00,   // already in logerror space
  livingAreaRatio:      -0.055,
  propertyAge:           0.00082,
  countyTe:              1.00,   // already in logerror space
  structureLandRatio:    0.0072,
  geoClusterDensity:    -0.0000042,
  monthSin:              0.0148,
  ageClusterInteraction: 0.000078,
};

// Global mean of logerror in the training set (E[f(x)])
const BASE_VALUE = 0.01155;

// Approximate confidence half-width (model std of residuals ≈ 0.072)
const MODEL_SIGMA = 0.072;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/** Tiny deterministic noise seeded from property characteristics */
function pseudoNoise(seed: number, amplitude: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2 * amplitude;
}

// ---------------------------------------------------------------------------
// Feature engineering (mirrors feature_engineering.py)
// ---------------------------------------------------------------------------

function engineerFeatures(p: PropertyInput) {
  const propertyAge        = 2016 - p.yearBuilt;
  const taxRatio           = p.taxAmount / (p.taxValue + 1);
  const livingAreaRatio    = p.finishedSqFt / (p.lotSizeSqFt + 1);

  // Structure / land tax split (approximated — form doesn't collect these separately)
  const structureTaxValue  = p.taxValue * 0.60;
  const landTaxValue       = p.taxValue * 0.40;
  const structureLandRatio = structureTaxValue / (landTaxValue + 1);

  const monthSin           = Math.sin((2 * Math.PI * p.transactionMonth) / 12);

  // Geographic encodings (approximated from county lookup + noise)
  const countyTe           = COUNTY_TE[p.county];
  const noise              = pseudoNoise(p.yearBuilt + p.finishedSqFt * 0.01, COUNTY_CLUSTER_TE_NOISE[p.county]);
  const geoClusterTe       = clamp(countyTe + noise, -0.05, 0.08);

  const geoClusterDensity  = COUNTY_CLUSTER_DENSITY[p.county] +
                             pseudoNoise(p.lotSizeSqFt * 0.001, 400);

  const clusterIdx         = COUNTY_CLUSTER_IDX[p.county];
  const ageClusterInteraction = propertyAge * clusterIdx;

  return {
    taxRatio,
    livingAreaRatio,
    propertyAge,
    structureLandRatio,
    monthSin,
    countyTe,
    geoClusterTe,
    geoClusterDensity,
    ageClusterInteraction,
  };
}

// ---------------------------------------------------------------------------
// SHAP descriptions
// ---------------------------------------------------------------------------

function describeFeature(key: string, value: number, shap: number): string {
  const dir   = shap > 0 ? 'increased' : 'decreased';
  const trend = shap > 0 ? 'overestimation' : 'underestimation';

  switch (key) {
    case 'taxRatio':
      return shap > 0
        ? `High tax burden (${(value * 100).toFixed(2)}% of assessed value) ${dir} error by ${fmt(shap)} — properties with disproportionate tax tend to be overestimated.`
        : `Moderate tax burden (${(value * 100).toFixed(2)}% of assessed value) ${dir} error by ${fmt(shap)} — tax load is well-aligned with assessed value.`;

    case 'geoClusterTe':
      return `Neighbourhood cluster mean logerror of ${fmt(value)} ${dir} the prediction by ${fmt(shap)} — this geographic pocket historically trends toward ${trend}.`;

    case 'livingAreaRatio':
      return shap > 0
        ? `Low lot utilisation (${(value * 100).toFixed(1)}% built-out) ${dir} error by ${fmt(shap)} — under-developed lots are harder for Zillow's algorithm to price.`
        : `High lot utilisation (${(value * 100).toFixed(1)}% built-out) ${dir} error by ${fmt(shap)} — densely built properties have more comparable sales, reducing error.`;

    case 'propertyAge':
      return shap > 0
        ? `Older property (${Math.round(value)} yrs) ${dir} error by ${fmt(shap)} — vintage homes have fewer recent comps, leading to systematic overestimation.`
        : `Newer property (${Math.round(value)} yrs) ${dir} error by ${fmt(shap)} — recent construction has abundant sales data, shrinking prediction error.`;

    case 'countyTe':
      return `${
        { LA: 'Los Angeles', Orange: 'Orange', Ventura: 'Ventura' }[
          value > 0.013 ? (value > 0.017 ? 'Ventura' : 'LA') : 'Orange'
        ]
      } county mean logerror (${fmt(value)}) ${dir} the prediction by ${fmt(shap)} — county-level market dynamics contribute to systematic ${trend}.`;

    case 'structureLandRatio':
      return shap > 0
        ? `High structure-to-land ratio (${value.toFixed(2)}) ${dir} error by ${fmt(shap)} — improvement-heavy parcels are often overvalued in automated models.`
        : `Low structure-to-land ratio (${value.toFixed(2)}) ${dir} error by ${fmt(shap)} — land-dominant parcels are priced more conservatively, reducing overestimation.`;

    case 'geoClusterDensity':
      return shap > 0
        ? `Sparse cluster (${Math.round(value)} properties) ${dir} error by ${fmt(shap)} — fewer comps in this area reduce estimation confidence.`
        : `Dense cluster (${Math.round(value)} properties) ${dir} error by ${fmt(shap)} — abundant nearby sales anchor the Zestimate more precisely.`;

    case 'monthSin':
      return `Seasonal timing (month_sin=${value.toFixed(3)}) ${dir} error by ${fmt(shap)} — ${
        value > 0.3 ? 'peak summer season creates pricing pressure above typical comps.'
        : value < -0.3 ? 'winter slow season dampens pricing, pulling estimates toward the mean.'
        : 'mid-season transaction with minimal seasonal bias.'
      }`;

    case 'ageClusterInteraction':
      return `Age × cluster interaction (${Math.round(value)}) ${dir} error by ${fmt(shap)} — ${
        shap > 0
          ? 'older properties in peripheral clusters amplify estimation difficulty.'
          : 'newer properties in dense clusters benefit from reinforcing comps.'
      }`;

    default:
      return `Feature contribution: ${fmt(shap)}`;
  }
}

function fmt(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(4);
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export function computeShap(p: PropertyInput): ShapResult {
  const eng = engineerFeatures(p);

  // Compute raw deviations and SHAP values
  const rawShap: Record<string, { eng: number; shap: number }> = {
    taxRatio:              { eng: eng.taxRatio,              shap: SENSITIVITY.taxRatio              * (eng.taxRatio              - TYPICAL.taxRatio) },
    geoClusterTe:          { eng: eng.geoClusterTe,          shap: SENSITIVITY.geoClusterTe          * (eng.geoClusterTe          - TYPICAL.geoClusterTe) },
    livingAreaRatio:       { eng: eng.livingAreaRatio,       shap: SENSITIVITY.livingAreaRatio       * (eng.livingAreaRatio       - TYPICAL.livingAreaRatio) },
    propertyAge:           { eng: eng.propertyAge,           shap: SENSITIVITY.propertyAge           * (eng.propertyAge           - TYPICAL.propertyAge) },
    countyTe:              { eng: eng.countyTe,              shap: SENSITIVITY.countyTe              * (eng.countyTe              - TYPICAL.countyTe) },
    structureLandRatio:    { eng: eng.structureLandRatio,    shap: SENSITIVITY.structureLandRatio    * (eng.structureLandRatio    - TYPICAL.structureLandRatio) },
    geoClusterDensity:     { eng: eng.geoClusterDensity,     shap: SENSITIVITY.geoClusterDensity     * (eng.geoClusterDensity     - TYPICAL.geoClusterDensity) },
    monthSin:              { eng: eng.monthSin,              shap: SENSITIVITY.monthSin              * (eng.monthSin              - TYPICAL.monthSin) },
    ageClusterInteraction: { eng: eng.ageClusterInteraction, shap: SENSITIVITY.ageClusterInteraction * (eng.ageClusterInteraction - TYPICAL.ageClusterInteraction) },
  };

  // Labels and formatters
  const META: Record<string, { label: string; format: (v: number) => string }> = {
    taxRatio:              { label: 'Tax Ratio',                  format: (v) => (v * 100).toFixed(3) + '%' },
    geoClusterTe:          { label: 'Geo Cluster (TE)',           format: (v) => v.toFixed(4) },
    livingAreaRatio:       { label: 'Living Area Ratio',          format: (v) => (v * 100).toFixed(1) + '%' },
    propertyAge:           { label: 'Property Age',               format: (v) => Math.round(v) + ' yrs' },
    countyTe:              { label: 'County (TE)',                format: (v) => v.toFixed(4) },
    structureLandRatio:    { label: 'Structure / Land Ratio',     format: (v) => v.toFixed(3) },
    geoClusterDensity:     { label: 'Cluster Density',            format: (v) => Math.round(v).toLocaleString() },
    monthSin:              { label: 'Month sin',                  format: (v) => v.toFixed(3) },
    ageClusterInteraction: { label: 'Age × Cluster Interaction',  format: (v) => Math.round(v).toString() },
  };

  const features: ShapFeature[] = Object.entries(rawShap)
    .map(([key, { eng: engVal, shap }]) => ({
      feature:     key,
      label:       META[key].label,
      rawValue:    META[key].format(engVal),
      shapValue:   shap,
      description: describeFeature(key, engVal, shap),
    }))
    .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));

  const totalShap   = features.reduce((s, f) => s + f.shapValue, 0);
  const prediction  = BASE_VALUE + totalShap;
  const sigma       = MODEL_SIGMA;

  return {
    baseValue:       BASE_VALUE,
    prediction,
    confidenceLow:   prediction - 1.645 * sigma,
    confidenceHigh:  prediction + 1.645 * sigma,
    features,
  };
}

// ---------------------------------------------------------------------------
// "Surprise me" — random realistic Southern California property
// ---------------------------------------------------------------------------

export function randomProperty(): PropertyInput {
  function rnd(lo: number, hi: number) {
    return Math.round(lo + Math.random() * (hi - lo));
  }

  const counties: County[] = ['LA', 'Orange', 'Ventura'];
  const county = counties[Math.floor(Math.random() * 3)];

  const taxValue  = rnd(250_000, 950_000);
  const taxAmount = Math.round(taxValue * (0.009 + Math.random() * 0.008));

  return {
    yearBuilt:       rnd(1940, 2014),
    finishedSqFt:    rnd(800, 4_200),
    lotSizeSqFt:     rnd(3_000, 22_000),
    taxAmount,
    taxValue,
    transactionMonth: rnd(1, 12),
    county,
  };
}
