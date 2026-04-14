export type County = 'LA' | 'Orange' | 'Ventura';

export interface PropertyInput {
  yearBuilt: number;
  finishedSqFt: number;
  lotSizeSqFt: number;
  taxAmount: number;
  taxValue: number;
  transactionMonth: number; // 1–12
  county: County;
  zestimate?: number;
}

export interface EngineeredFeatures {
  property_age: number;
  tax_ratio: number;
  living_area_ratio: number;
  month_sin: number;
  month_cos: number;
  county_te: number;
  geo_cluster_te: number;
}

const COUNTY_TE: Record<County, number> = {
  LA: 0.0142,
  Orange: -0.0089,
  Ventura: 0.0031,
};

export function computeFeatures(input: PropertyInput): EngineeredFeatures {
  const property_age = 2016 - input.yearBuilt;
  const tax_ratio = input.taxAmount / (input.taxValue + 1);
  const living_area_ratio = input.finishedSqFt / (input.lotSizeSqFt + 1);
  const month_sin = Math.sin((2 * Math.PI * input.transactionMonth) / 12);
  const month_cos = Math.cos((2 * Math.PI * input.transactionMonth) / 12);
  const county_te = COUNTY_TE[input.county];

  // geo_cluster_te: derived from tax_ratio buckets
  let geo_cluster_te: number;
  if (tax_ratio < 0.01) {
    geo_cluster_te = -0.008;
  } else if (tax_ratio < 0.02) {
    geo_cluster_te = 0.012;
  } else {
    geo_cluster_te = 0.024;
  }

  return {
    property_age,
    tax_ratio,
    living_area_ratio,
    month_sin,
    month_cos,
    county_te,
    geo_cluster_te,
  };
}
