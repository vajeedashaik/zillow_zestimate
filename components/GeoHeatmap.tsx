'use client';

/**
 * GeoHeatmap.tsx
 *
 * Interactive Leaflet map showing Zestimate logerror hotspots across
 * LA, Orange and Ventura counties.
 *
 * Architecture (Next.js App Router safe):
 *  - This file is a "use client" component.
 *  - Import it in the page with:
 *      const GeoHeatmap = dynamic(() => import('@/components/GeoHeatmap'), { ssr: false })
 *  - Leaflet CSS is imported here (client-only).
 *  - leaflet.heat plugin is loaded via useEffect to avoid SSR breakage.
 *
 * Visual layers:
 *  1. Dark CartoDB basemap
 *  2. Heatmap of logerror values  (blue = underestimated, red = overestimated)
 *  3. 25 KMeans cluster boundary polygons (dashed amber outline)
 *  4. Cluster ID labels at centroids
 *  5. Fixed legend overlay
 *  6. Popup on cluster click (mean logerror, count, top SHAP feature)
 */

import { useEffect, useRef, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  PROPERTIES,
  CLUSTERS,
  COUNTY_BOUNDS,
  type Property,
  type ClusterInfo,
  type County,
} from '@/data/mockGeoData';
import type { FilterState } from '@/components/HeatmapSidebar';

// ─── Fix Leaflet default-icon paths broken by webpack ─────────────────────────
// (react-leaflet v4 + Next.js issue)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Heatmap layer (uses leaflet.heat plugin) ─────────────────────────────────
interface HeatmapLayerProps {
  data: Property[];
}

function HeatmapLayer({ data }: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map) return;

    // Remove previous layer
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    if (data.length === 0) return;

    // leaflet.heat is a CJS side-effect plugin — import it dynamically so
    // it runs client-side only and patches L with .heatLayer before use.
    import('leaflet.heat').then(() => {
      // Remove again in case data changed while the import was in flight
      if (layerRef.current) {
        (layerRef.current as L.Layer).remove();
        layerRef.current = null;
      }

      // leaflet.heat expects [lat, lon, intensity] where intensity ∈ [0, 1].
      // We map logerror [-0.5, +0.5] → [0, 1] so:
      //   0   = blue  (strongly underestimated, logerror ≈ -0.5)
      //   0.5 = white (accurate,               logerror ≈  0)
      //   1   = red   (strongly overestimated,  logerror ≈ +0.5)
      const heatPoints = data.map(
        (p) => [p.lat, p.lon, (p.logerror + 0.5)] as [number, number, number]
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layer = (L as any).heatLayer(heatPoints, {
        radius: 22,
        blur: 18,
        maxZoom: 17,
        max: 1.0,
        minOpacity: 0.25,
        gradient: {
          0.00: '#1e3a8a',  // deep blue  (logerror ≈ -0.5 – Zestimate underestimates)
          0.25: '#60a5fa',  // sky blue
          0.45: '#e0f2fe',  // pale blue-white
          0.50: '#f8fafc',  // near white  (accurate)
          0.55: '#fee2e2',  // pale red-white
          0.75: '#f87171',  // salmon red
          1.00: '#7f1d1d',  // deep red   (logerror ≈ +0.5 – Zestimate overestimates)
        },
      });

      layerRef.current = layer;
      layer.addTo(map);
    });

    return () => {
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
    };
  }, [data, map]);

  return null;
}

// ─── Cluster polygon + popup ───────────────────────────────────────────────────
interface ClusterPolygonProps {
  cluster: ClusterInfo;
  visible: boolean;
}

function ClusterPolygon({ cluster, visible }: ClusterPolygonProps) {
  const errLabel =
    cluster.mean_logerror > 0.02
      ? '↑ Overestimated'
      : cluster.mean_logerror < -0.02
      ? '↓ Underestimated'
      : '≈ Accurate';

  const errColour =
    cluster.mean_logerror > 0.02
      ? '#f87171'
      : cluster.mean_logerror < -0.02
      ? '#60a5fa'
      : '#94a3b8';

  if (!visible) return null;

  return (
    <Polygon
      positions={cluster.polygon}
      pathOptions={{
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '5 4',
        fillColor: '#f59e0b',
        fillOpacity: 0.04,
      }}
    >
      <Popup
        className="cluster-popup"
        maxWidth={260}
        minWidth={220}
      >
        <div className="font-sans text-sm text-gray-800 space-y-1 p-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-base text-gray-900">
              Cluster {cluster.id}
            </span>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ background: errColour + '30', color: errColour }}
            >
              {errLabel}
            </span>
          </div>
          <div className="border-t border-gray-200 pt-1 space-y-0.5">
            <Row label="County"       value={cluster.county} />
            <Row
              label="Mean logerror"
              value={cluster.mean_logerror.toFixed(4)}
              mono
            />
            <Row label="Properties"   value={cluster.property_count.toLocaleString()} />
            <Row
              label="Top SHAP feature"
              value={cluster.top_shap_feature}
              mono
            />
          </div>
          <p className="text-[10px] text-gray-400 pt-0.5">
            SHAP from XGBoost TreeExplainer
          </p>
        </div>
      </Popup>
    </Polygon>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Cluster ID label markers ──────────────────────────────────────────────────
function ClusterLabels({ clusters }: { clusters: ClusterInfo[] }) {
  return (
    <>
      {clusters.map((c) => (
        <Marker
          key={c.id}
          position={c.center}
          icon={L.divIcon({
            html: `<span style="
              background:rgba(15,17,23,0.80);
              color:#f59e0b;
              border:1px solid rgba(245,158,11,0.35);
              padding:1px 5px;
              border-radius:4px;
              font-size:11px;
              font-weight:700;
              line-height:1.4;
              white-space:nowrap;
              pointer-events:none;
            ">${c.id}</span>`,
            className: '',
            iconAnchor: [13, 10],
          })}
          interactive={false}
        />
      ))}
    </>
  );
}

// ─── Auto-fit map bounds when county filter changes ────────────────────────────
function BoundsFitter({ county }: { county: County | 'All' }) {
  const map = useMap();
  useEffect(() => {
    const bounds = COUNTY_BOUNDS[county];
    map.fitBounds(bounds, { padding: [20, 20], animate: true });
  }, [county, map]);
  return null;
}

// ─── Legend overlay (fixed position inside map) ───────────────────────────────
function MapLegend() {
  return (
    <div
      className="absolute bottom-6 right-3 z-[1000] select-none"
      style={{ pointerEvents: 'none' }}
    >
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3 text-xs shadow-2xl min-w-[165px]">
        <p className="text-gray-200 font-semibold mb-2 tracking-wide uppercase text-[10px]">
          Log Error Scale
        </p>

        {/* gradient bar */}
        <div
          className="h-3 rounded-sm mb-1"
          style={{
            background:
              'linear-gradient(to right, #1e3a8a, #60a5fa, #f8fafc, #f87171, #7f1d1d)',
          }}
        />
        <div className="flex justify-between text-gray-400 mb-2 text-[10px]">
          <span>−0.5</span>
          <span>0</span>
          <span>+0.5</span>
        </div>

        <div className="space-y-1">
          <LegendRow color="#7f1d1d" label="Overestimated (positive)" />
          <LegendRow color="#1e3a8a" label="Underestimated (negative)" />
          <LegendRow color="#f8fafc" label="Accurate (≈ 0)" dot />
        </div>

        <div className="mt-2 border-t border-gray-700 pt-2">
          <div className="flex items-center gap-2 text-gray-400 text-[10px]">
            <svg width="22" height="10" viewBox="0 0 22 10">
              <line
                x1="0" y1="5" x2="22" y2="5"
                stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3"
              />
            </svg>
            <span>Cluster boundary</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-[10px] mt-1">
            <span className="font-bold text-amber-400 text-[11px] bg-gray-800 px-1 rounded">
              0
            </span>
            <span>Cluster ID (click to inspect)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  dot = false,
}: {
  color: string;
  label: string;
  dot?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block rounded-sm flex-shrink-0"
        style={{
          width: 14,
          height: 14,
          background: color,
          border: dot ? '1px solid #94a3b8' : 'none',
        }}
      />
      <span className="text-gray-400 text-[10px]">{label}</span>
    </div>
  );
}

// ─── Main GeoHeatmap component ─────────────────────────────────────────────────
interface GeoHeatmapProps {
  filters: FilterState;
}

export default function GeoHeatmap({ filters }: GeoHeatmapProps) {
  const [showClusters, setShowClusters] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // ── Filter properties based on sidebar state ────────────────────────────────
  const filteredProps = useMemo<Property[]>(() => {
    const { counties, logerrorRange, propertyAgeRange } = filters;
    return PROPERTIES.filter(
      (p) =>
        (counties.length === 0 || counties.includes(p.county)) &&
        p.logerror >= logerrorRange[0] &&
        p.logerror <= logerrorRange[1] &&
        p.property_age >= propertyAgeRange[0] &&
        p.property_age <= propertyAgeRange[1]
    );
  }, [filters]);

  // ── Filter clusters to visible counties ────────────────────────────────────
  const visibleClusters = useMemo<ClusterInfo[]>(() => {
    if (filters.counties.length === 0) return CLUSTERS;
    return CLUSTERS.filter((c) => filters.counties.includes(c.county));
  }, [filters.counties]);

  const singleCounty =
    filters.counties.length === 1 ? filters.counties[0] : 'All';

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-gray-800">
      {/* ── Map toggle controls (top-left overlay) ───────────────────────────── */}
      <div className="absolute top-3 left-3 z-[1000] flex gap-2">
        <ToggleBtn
          active={showClusters}
          onClick={() => setShowClusters((v) => !v)}
          label="Clusters"
        />
        <ToggleBtn
          active={showLabels}
          onClick={() => setShowLabels((v) => !v)}
          label="Labels"
        />
      </div>

      {/* ── Property count badge ──────────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-[1000]">
        <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300">
          <span className="font-semibold text-white">
            {filteredProps.length.toLocaleString()}
          </span>{' '}
          properties shown
        </div>
      </div>

      <MapContainer
        center={[33.95, -118.25]}
        zoom={9}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={true}
      >
        {/* Dark basemap */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Heatmap */}
        <HeatmapLayer data={filteredProps} />

        {/* Cluster polygons */}
        {showClusters &&
          CLUSTERS.map((c) => (
            <ClusterPolygon
              key={c.id}
              cluster={c}
              visible={visibleClusters.some((vc) => vc.id === c.id)}
            />
          ))}

        {/* Cluster ID labels */}
        {showLabels && showClusters && (
          <ClusterLabels clusters={visibleClusters} />
        )}

        {/* Auto-fit on county change */}
        <BoundsFitter county={singleCounty} />
      </MapContainer>

      {/* Legend */}
      <MapLegend />
    </div>
  );
}

// ─── Tiny toggle button ────────────────────────────────────────────────────────
function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-lg border backdrop-blur-sm transition-all ${
        active
          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
          : 'bg-gray-900/80 border-gray-700 text-gray-500'
      }`}
    >
      {label}
    </button>
  );
}
