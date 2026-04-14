'use client';

/**
 * HeatmapSidebar.tsx
 *
 * Filter panel for the Zillow Zestimate heatmap dashboard.
 *
 * Filters:
 *  1. County selector  – All / LA / Orange / Ventura (multi-toggle)
 *  2. logerror range   – dual slider from -0.5 to +0.5
 *  3. Property age     – dual slider from 0 to 100 years
 *
 * Also shows aggregated stats for currently filtered data.
 */

import { useMemo } from 'react';
import { PROPERTIES, CLUSTERS, type County } from '@/data/mockGeoData';

// ─── Public types ──────────────────────────────────────────────────────────────
export interface FilterState {
  counties: County[];
  logerrorRange: [number, number];
  propertyAgeRange: [number, number];
}

export const DEFAULT_FILTERS: FilterState = {
  counties: [],
  logerrorRange: [-0.5, 0.5],
  propertyAgeRange: [0, 100],
};

interface HeatmapSidebarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  filteredCount: number;
}

// ─── County definitions ────────────────────────────────────────────────────────
const ALL_COUNTIES: { id: County; label: string; fips: number }[] = [
  { id: 'LA',      label: 'Los Angeles',  fips: 6037 },
  { id: 'Orange',  label: 'Orange',       fips: 6059 },
  { id: 'Ventura', label: 'Ventura',      fips: 6111 },
];

export default function HeatmapSidebar({
  filters,
  onChange,
  filteredCount,
}: HeatmapSidebarProps) {
  // ── Compute live stats from filtered properties ──────────────────────────────
  const stats = useMemo(() => {
    const props = PROPERTIES.filter(
      (p) =>
        (filters.counties.length === 0 || filters.counties.includes(p.county)) &&
        p.logerror >= filters.logerrorRange[0] &&
        p.logerror <= filters.logerrorRange[1] &&
        p.property_age >= filters.propertyAgeRange[0] &&
        p.property_age <= filters.propertyAgeRange[1]
    );

    if (props.length === 0)
      return { mean: 0, overPct: 0, underPct: 0, accuratePct: 0 };

    const mean = props.reduce((s, p) => s + p.logerror, 0) / props.length;
    const overPct  = (props.filter((p) => p.logerror >  0.02).length / props.length) * 100;
    const underPct = (props.filter((p) => p.logerror < -0.02).length / props.length) * 100;
    const accuratePct = 100 - overPct - underPct;

    return { mean, overPct, underPct, accuratePct };
  }, [filters]);

  // ── Cluster count for visible counties ───────────────────────────────────────
  const visibleClusters =
    filters.counties.length === 0
      ? CLUSTERS.length
      : CLUSTERS.filter((c) => filters.counties.includes(c.county)).length;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  function toggleCounty(county: County) {
    const next = filters.counties.includes(county)
      ? filters.counties.filter((c) => c !== county)
      : [...filters.counties, county];
    onChange({ ...filters, counties: next });
  }

  function setLogerrorMin(v: number) {
    const min = Math.min(v, filters.logerrorRange[1] - 0.05);
    onChange({ ...filters, logerrorRange: [min, filters.logerrorRange[1]] });
  }

  function setLogerrorMax(v: number) {
    const max = Math.max(v, filters.logerrorRange[0] + 0.05);
    onChange({ ...filters, logerrorRange: [filters.logerrorRange[0], max] });
  }

  function setAgeMin(v: number) {
    const min = Math.min(v, filters.propertyAgeRange[1] - 1);
    onChange({ ...filters, propertyAgeRange: [min, filters.propertyAgeRange[1]] });
  }

  function setAgeMax(v: number) {
    const max = Math.max(v, filters.propertyAgeRange[0] + 1);
    onChange({ ...filters, propertyAgeRange: [filters.propertyAgeRange[0], max] });
  }

  function resetFilters() {
    onChange(DEFAULT_FILTERS);
  }

  const isDirty =
    filters.counties.length > 0 ||
    filters.logerrorRange[0] !== -0.5 ||
    filters.logerrorRange[1] !==  0.5 ||
    filters.propertyAgeRange[0] !== 0 ||
    filters.propertyAgeRange[1] !== 100;

  return (
    <aside className="flex flex-col gap-5 h-full overflow-y-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-white font-bold text-lg leading-tight">
          Filters
        </h2>
        <p className="text-gray-500 text-xs mt-0.5">
          Adjust to explore error hotspots
        </p>
      </div>

      {/* ── Stats summary ──────────────────────────────────────────────────── */}
      <div className="bg-gray-800/60 rounded-xl p-3 space-y-2 border border-gray-700/50">
        <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">
          Visible summary
        </p>
        <StatRow label="Properties" value={filteredCount.toLocaleString()} />
        <StatRow label="Clusters"   value={visibleClusters.toString()} />
        <StatRow
          label="Mean logerror"
          value={stats.mean >= 0 ? `+${stats.mean.toFixed(4)}` : stats.mean.toFixed(4)}
          valueClass={
            stats.mean > 0.01
              ? 'text-red-400'
              : stats.mean < -0.01
              ? 'text-blue-400'
              : 'text-gray-300'
          }
        />

        {/* Mini bar chart */}
        <div className="pt-1">
          <p className="text-gray-500 text-[10px] mb-1">Distribution</p>
          <div className="flex h-3 rounded overflow-hidden gap-px">
            <div
              className="bg-blue-600 transition-all duration-300"
              style={{ width: `${stats.underPct.toFixed(1)}%` }}
              title={`Under: ${stats.underPct.toFixed(1)}%`}
            />
            <div
              className="bg-gray-600 transition-all duration-300"
              style={{ width: `${stats.accuratePct.toFixed(1)}%` }}
              title={`Accurate: ${stats.accuratePct.toFixed(1)}%`}
            />
            <div
              className="bg-red-600 transition-all duration-300"
              style={{ width: `${stats.overPct.toFixed(1)}%` }}
              title={`Over: ${stats.overPct.toFixed(1)}%`}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
            <span>Under {stats.underPct.toFixed(0)}%</span>
            <span>Accurate {stats.accuratePct.toFixed(0)}%</span>
            <span>Over {stats.overPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* ── County selector ────────────────────────────────────────────────── */}
      <FilterSection title="County">
        <div className="space-y-1.5">
          {/* All button */}
          <button
            onClick={() => onChange({ ...filters, counties: [] })}
            className={`w-full text-left text-sm px-3 py-1.5 rounded-lg border transition-all ${
              filters.counties.length === 0
                ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-300 font-medium'
                : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            All Counties
          </button>

          {ALL_COUNTIES.map(({ id, label, fips }) => {
            const active = filters.counties.includes(id);
            const clusterCount = CLUSTERS.filter((c) => c.county === id).length;
            return (
              <button
                key={id}
                onClick={() => toggleCounty(id)}
                className={`w-full flex items-center justify-between text-sm px-3 py-1.5 rounded-lg border transition-all ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-medium'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                <span>{label}</span>
                <span className="text-[10px] text-gray-600 font-normal">
                  FIPS {fips} · {clusterCount} clusters
                </span>
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* ── logerror range ─────────────────────────────────────────────────── */}
      <FilterSection title="Log Error Range">
        <p className="text-gray-500 text-xs -mt-1 mb-2">
          Positive = Zestimate overestimated · Negative = underestimated
        </p>

        <div className="space-y-3">
          <DualSlider
            label="Min"
            value={filters.logerrorRange[0]}
            min={-0.5}
            max={0.5}
            step={0.01}
            onChange={setLogerrorMin}
            formatValue={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            trackColor={
              filters.logerrorRange[0] < 0 ? '#3b82f6' : '#ef4444'
            }
          />
          <DualSlider
            label="Max"
            value={filters.logerrorRange[1]}
            min={-0.5}
            max={0.5}
            step={0.01}
            onChange={setLogerrorMax}
            formatValue={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            trackColor={
              filters.logerrorRange[1] > 0 ? '#ef4444' : '#3b82f6'
            }
          />
        </div>

        {/* Visual range bar */}
        <div className="mt-3 relative h-2 bg-gray-700 rounded">
          <div
            className="absolute h-2 rounded"
            style={{
              left: `${((filters.logerrorRange[0] + 0.5) / 1.0) * 100}%`,
              right: `${100 - ((filters.logerrorRange[1] + 0.5) / 1.0) * 100}%`,
              background:
                'linear-gradient(to right, #3b82f6, #f8fafc, #ef4444)',
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>−0.5</span>
          <span>0</span>
          <span>+0.5</span>
        </div>
      </FilterSection>

      {/* ── Property age range ─────────────────────────────────────────────── */}
      <FilterSection title="Property Age (years)">
        <div className="space-y-3">
          <DualSlider
            label="Min age"
            value={filters.propertyAgeRange[0]}
            min={0}
            max={100}
            step={1}
            onChange={setAgeMin}
            formatValue={(v) => `${v}y`}
            trackColor="#6366f1"
          />
          <DualSlider
            label="Max age"
            value={filters.propertyAgeRange[1]}
            min={0}
            max={100}
            step={1}
            onChange={setAgeMax}
            formatValue={(v) => `${v}y`}
            trackColor="#6366f1"
          />
        </div>

        <div className="mt-3 relative h-2 bg-gray-700 rounded">
          <div
            className="absolute h-2 bg-indigo-500 rounded"
            style={{
              left: `${filters.propertyAgeRange[0]}%`,
              right: `${100 - filters.propertyAgeRange[1]}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>0y</span>
          <span>50y</span>
          <span>100y</span>
        </div>
      </FilterSection>

      {/* ── Reset button ────────────────────────────────────────────────────── */}
      {isDirty && (
        <button
          onClick={resetFilters}
          className="mt-auto w-full py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-red-800 hover:text-red-400 transition-all"
        >
          Reset filters
        </button>
      )}

      {/* ── Model info footer ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-800 pt-4 space-y-1">
        <p className="text-gray-600 text-[10px] leading-relaxed">
          Data: Mock simulation based on model.py ensemble (XGBoost + LightGBM +
          CatBoost · meta Ridge). SHAP via TreeExplainer.
        </p>
        <p className="text-gray-600 text-[10px]">
          Source: Zillow Prize 1 · LA / Orange / Ventura counties
        </p>
      </div>
    </aside>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-gray-300 font-semibold text-sm tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatRow({
  label,
  value,
  valueClass = 'text-gray-300',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-xs font-mono font-semibold ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function DualSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  trackColor,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
  trackColor: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 text-xs w-14 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={
          {
            background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${
              ((value - min) / (max - min)) * 100
            }%, #374151 ${((value - min) / (max - min)) * 100}%, #374151 100%)`,
            '--thumb-color': trackColor,
          } as React.CSSProperties
        }
      />
      <span
        className="text-xs font-mono w-12 text-right flex-shrink-0"
        style={{ color: trackColor }}
      >
        {formatValue(value)}
      </span>
    </div>
  );
}
