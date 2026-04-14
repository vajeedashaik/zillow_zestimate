/**
 * mockGeoData.ts
 *
 * Simulated property data derived from the model.py structure:
 * - 25 KMeans spatial clusters (k=25 as in model.py section 07)
 * - Counties: LA (FIPS 6037), Orange (FIPS 6059), Ventura (FIPS 6111)
 * - logerror = log(Zestimate) - log(SalePrice), clipped to [-0.5, +0.5]
 * - SHAP features from XGBoost TreeExplainer (final_xgb in model.py)
 * - 500 properties per cluster = 12,500 total data points
 */

export type County = 'LA' | 'Orange' | 'Ventura';

export interface Property {
  id: number;
  lat: number;
  lon: number;
  logerror: number;
  county: County;
  property_age: number;  // years (0–100)
  cluster_id: number;
}

export interface ClusterInfo {
  id: number;
  center: [number, number];  // [lat, lon]
  county: County;
  mean_logerror: number;
  std_logerror: number;
  property_count: number;
  top_shap_feature: string;
  polygon: [number, number][];  // octagonal boundary
}

// ─── Seeded PRNG (LCG) ────────────────────────────────────────────────────────
function makePRNG(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s >>>= 0;
    return s / 0x100000000;
  };
}

// Box-Muller: uniform → normal(mean, std)
function normal(rng: () => number, mean: number, std: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Octagonal cluster boundary ───────────────────────────────────────────────
function makePolygon(
  center: [number, number],
  radiusLat = 0.085,
  radiusLon = 0.11  // wider: lon degrees are shorter at ~34°N
): [number, number][] {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
    return [
      center[0] + radiusLat * Math.cos(angle),
      center[1] + radiusLon * Math.sin(angle),
    ] as [number, number];
  });
}

// ─── Top SHAP features (from XGBoost TreeExplainer in model.py) ───────────────
const SHAP_FEATURES = [
  'taxvaluedollarcnt',
  'calculatedfinishedsquarefeet',
  'geo_cluster_te',
  'latitude',
  'property_age',
  'tax_ratio',
  'cluster_mean_tax',
  'living_area_ratio',
  'structure_land_ratio',
  'longitude',
  'geo_cluster_density',
  'age_cluster_interaction',
  'month_sin',
  'total_bath',
  'cluster_mean_area',
];

// ─── Cluster definitions (25 clusters mirroring KMeans k=25) ─────────────────
// Each entry: [lat, lon, county, mean_logerror, std_logerror, shap_feature_idx]
const CLUSTER_DEFS: [number, number, County, number, number, number][] = [
  // ── Los Angeles County (15 clusters) ─────────────────────────────────────
  [34.0522, -118.2437, 'LA',      0.050,  0.120,  0],  //  0 Downtown LA
  [34.0395, -118.4712, 'LA',      0.105,  0.095,  1],  //  1 West LA / Culver City
  [33.8530, -118.3406, 'LA',     -0.035,  0.110,  2],  //  2 South Bay / Compton
  [34.1841, -118.4524, 'LA',      0.080,  0.130,  4],  //  3 San Fernando Valley W
  [34.0195, -118.1709, 'LA',     -0.075,  0.140,  6],  //  4 East LA / Montebello
  [34.1478, -118.1445, 'LA',      0.155,  0.088,  5],  //  5 Pasadena
  [33.7701, -118.1937, 'LA',     -0.120,  0.155,  3],  //  6 Long Beach
  [34.1809, -118.3090, 'LA',      0.060,  0.108,  7],  //  7 Burbank / Glendale
  [34.0195, -118.4912, 'LA',      0.185,  0.078,  8],  //  8 Santa Monica / Brentwood
  [33.9756, -118.0320, 'LA',     -0.090,  0.162,  9],  //  9 Whittier
  [33.8358, -118.3430, 'LA',     -0.042,  0.118, 10],  // 10 Torrance
  [33.9617, -118.3531, 'LA',      0.022,  0.132, 11],  // 11 Inglewood / Hawthorne
  [34.0553, -117.7510, 'LA',     -0.150,  0.168, 12],  // 12 Pomona / Diamond Bar
  [34.0686, -118.0272, 'LA',      0.032,  0.122,  1],  // 13 El Monte / Baldwin Park
  [34.2364, -118.5370, 'LA',      0.118,  0.098,  4],  // 14 Northridge / Granada Hills
  // ── Orange County (7 clusters) ────────────────────────────────────────────
  [33.8353, -117.9145, 'Orange', -0.058,  0.108,  0],  // 15 Anaheim
  [33.7455, -117.8677, 'Orange', -0.098,  0.138,  6],  // 16 Santa Ana / Garden Grove
  [33.6846, -117.7946, 'Orange',  0.130,  0.090,  7],  // 17 Irvine / Newport Beach
  [33.8703, -117.9242, 'Orange',  0.042,  0.118,  2],  // 18 Fullerton / Placentia
  [33.6595, -117.9988, 'Orange', -0.082,  0.128,  3],  // 19 Huntington Beach
  [33.7879, -117.8531, 'Orange',  0.068,  0.112,  5],  // 20 Orange City / Villa Park
  [33.6411, -117.9187, 'Orange', -0.048,  0.122,  8],  // 21 Costa Mesa
  // ── Ventura County (3 clusters) ───────────────────────────────────────────
  [34.2747, -119.2290, 'Ventura',  0.092, 0.128,  0],  // 22 Ventura / San Buenaventura
  [34.1975, -119.1771, 'Ventura', -0.138, 0.158,  6],  // 23 Oxnard / Port Hueneme
  [34.1706, -118.8376, 'Ventura',  0.202, 0.075,  4],  // 24 Thousand Oaks / Westlake
];

// ─── Build CLUSTERS array ─────────────────────────────────────────────────────
export const CLUSTERS: ClusterInfo[] = CLUSTER_DEFS.map(
  ([lat, lon, county, mean_le, std_le, shapIdx], id) => ({
    id,
    center: [lat, lon] as [number, number],
    county,
    mean_logerror: mean_le,
    std_logerror: std_le,
    property_count: 500,
    top_shap_feature: SHAP_FEATURES[shapIdx],
    polygon: makePolygon([lat, lon]),
  })
);

// ─── Build PROPERTIES array (500 per cluster × 25 = 12,500 total) ────────────
const PROPERTIES_PER_CLUSTER = 500;

function generateClusterProperties(cluster: ClusterInfo): Property[] {
  const rng = makePRNG(cluster.id * 7919 + 31337);
  const props: Property[] = [];

  for (let i = 0; i < PROPERTIES_PER_CLUSTER; i++) {
    // Scatter around centroid with ~0.05° spread
    const lat = cluster.center[0] + normal(rng, 0, 0.045);
    const lon = cluster.center[1] + normal(rng, 0, 0.055);

    // logerror: normal around cluster mean, clipped to [-0.5, 0.5]
    const rawLogerror = normal(rng, cluster.mean_logerror, cluster.std_logerror);
    const logerror = Math.max(-0.5, Math.min(0.5, rawLogerror));

    // Property age: normal around 40 years, clipped to [0, 100]
    const property_age = Math.max(0, Math.min(100, Math.round(normal(rng, 40, 22))));

    props.push({
      id: cluster.id * PROPERTIES_PER_CLUSTER + i,
      lat,
      lon,
      logerror,
      county: cluster.county,
      property_age,
      cluster_id: cluster.id,
    });
  }
  return props;
}

export const PROPERTIES: Property[] = CLUSTERS.flatMap(generateClusterProperties);

// ─── County FIPS mapping (matches model.py section 07) ───────────────────────
export const COUNTY_FIPS: Record<County, number> = {
  LA: 6037,
  Orange: 6059,
  Ventura: 6111,
};

// ─── Bounding boxes for county zoom (used by GeoHeatmap) ─────────────────────
export const COUNTY_BOUNDS: Record<County | 'All', [[number, number], [number, number]]> = {
  All:     [[33.40, -119.40], [34.50, -117.40]],
  LA:      [[33.70, -118.95], [34.35, -117.65]],
  Orange:  [[33.40, -118.15], [33.95, -117.40]],
  Ventura: [[34.05, -119.40], [34.45, -118.65]],
};
