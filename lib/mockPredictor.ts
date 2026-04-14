import { computeFeatures, type PropertyInput, type EngineeredFeatures } from './featureEngineering';

export type RiskBand = 'OVERPRICED' | 'FAIR' | 'UNDERPRICED';

export interface ShapContribution {
  feature: string;
  label: string;
  contribution: number;
}

export interface PredictionResult {
  logerror: number;
  confidence_low: number;
  confidence_high: number;
  riskBand: RiskBand;
  shapValues: ShapContribution[];
  features: EngineeredFeatures;
}

/** Deterministic ±0.002 noise seeded by input values — same inputs = same output */
function seededNoise(input: PropertyInput): number {
  const seed =
    input.yearBuilt * 17 +
    input.finishedSqFt * 31 +
    input.taxAmount * 7 +
    input.transactionMonth * 13;
  const x = Math.sin(seed) * 10000;
  return (x - Math.floor(x) - 0.5) * 0.004;
}

export function predict(input: PropertyInput): PredictionResult {
  const features = computeFeatures(input);

  const logerror =
    0.045 +
    features.tax_ratio * 1.82 +
    features.county_te * 0.8 +
    features.geo_cluster_te * 0.6 -
    features.property_age * 0.00015 +
    features.living_area_ratio * 0.003 +
    seededNoise(input);

  const confidence_low = logerror - 0.018;
  const confidence_high = logerror + 0.018;

  let riskBand: RiskBand;
  if (logerror > 0.03) riskBand = 'OVERPRICED';
  else if (logerror < -0.03) riskBand = 'UNDERPRICED';
  else riskBand = 'FAIR';

  const rawContributions: ShapContribution[] = [
    {
      feature: 'tax_ratio',
      label: 'Tax Rate',
      contribution: features.tax_ratio * 1.82,
    },
    {
      feature: 'geo_cluster_te',
      label: 'Cluster History',
      contribution: features.geo_cluster_te * 0.6,
    },
    {
      feature: 'county_te',
      label: 'County Avg Error',
      contribution: features.county_te * 0.8,
    },
    {
      feature: 'property_age',
      label: 'Property Age',
      contribution: -features.property_age * 0.00015,
    },
    {
      feature: 'living_area_ratio',
      label: 'Living Area Ratio',
      contribution: features.living_area_ratio * 0.003,
    },
  ];

  const shapValues = rawContributions.sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );

  return { logerror, confidence_low, confidence_high, riskBand, shapValues, features };
}
