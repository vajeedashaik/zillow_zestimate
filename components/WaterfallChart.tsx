'use client';

/**
 * WaterfallChart.tsx
 *
 * Renders a SHAP waterfall chart using Recharts ComposedChart.
 *
 * Each feature's SHAP contribution is shown as a bar that starts
 * where the previous bar ended. Positive contributions (push error up)
 * are red; negative (push error down) are blue.
 *
 * The chart layout:
 *   [ Base value ] → feature bars → [ Prediction ]
 */

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ShapFeature } from '@/lib/shapMock';

interface WaterfallChartProps {
  baseValue: number;
  prediction: number;
  features: ShapFeature[];
}

interface WaterfallRow {
  name: string;
  base: number;        // invisible stacked bottom
  value: number;       // visible bar height (always positive)
  positive: boolean;   // true = red, false = blue
  isEndpoint: boolean; // Base or Prediction bar
  total: number;       // running total after this bar (for tooltip)
  shapValue: number;   // signed SHAP for tooltip
}

function buildRows(
  baseValue: number,
  prediction: number,
  features: ShapFeature[]
): WaterfallRow[] {
  const rows: WaterfallRow[] = [];

  // ── Base value bar ─────────────────────────────────────────────────────────
  rows.push({
    name:       'Base Value',
    base:       0,
    value:      baseValue,
    positive:   baseValue >= 0,
    isEndpoint: true,
    total:      baseValue,
    shapValue:  baseValue,
  });

  // ── Feature contribution bars ──────────────────────────────────────────────
  let running = baseValue;

  // Show top 7 features to keep the chart readable
  const displayed = features.slice(0, 7);

  for (const f of displayed) {
    const shap = f.shapValue;
    const start = running;
    running += shap;

    // For stacked bars: invisible base + visible colored segment
    const base  = shap >= 0 ? start  : running; // lower edge of the visible bar
    const value = Math.abs(shap);

    rows.push({
      name:       f.label,
      base,
      value,
      positive:   shap >= 0,
      isEndpoint: false,
      total:      running,
      shapValue:  shap,
    });
  }

  // ── Prediction bar ─────────────────────────────────────────────────────────
  rows.push({
    name:       'Prediction',
    base:       0,
    value:      prediction,
    positive:   prediction >= 0,
    isEndpoint: true,
    total:      prediction,
    shapValue:  prediction,
  });

  return rows;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: WaterfallRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-300 font-semibold mb-1">{label}</p>
      {row.isEndpoint ? (
        <p className="text-gray-200 font-mono">
          {row.shapValue >= 0 ? '+' : ''}{row.shapValue.toFixed(5)}
        </p>
      ) : (
        <>
          <p className={`font-mono font-bold ${row.positive ? 'text-red-400' : 'text-blue-400'}`}>
            {row.shapValue >= 0 ? '+' : ''}{row.shapValue.toFixed(5)}
          </p>
          <p className="text-gray-500 mt-0.5">
            Running total: {row.total >= 0 ? '+' : ''}{row.total.toFixed(5)}
          </p>
        </>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function WaterfallChart({
  baseValue,
  prediction,
  features,
}: WaterfallChartProps) {
  const rows = buildRows(baseValue, prediction, features);

  // Dynamic Y-axis domain with padding
  const allTotals = rows.map((r) => r.total);
  const allBases  = rows.map((r) => r.base);
  const yMin = Math.min(...allBases, ...allTotals);
  const yMax = Math.max(...allBases, ...allTotals);
  const pad  = (yMax - yMin) * 0.15 || 0.005;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 16, left: 0, bottom: 80 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => v.toFixed(3)}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[yMin - pad, yMax + pad]}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1} />

          {/* Invisible "spacer" bar that creates the floating effect */}
          <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />

          {/* Visible colored bar */}
          <Bar dataKey="value" stackId="wf" radius={[2, 2, 0, 0]} maxBarSize={48} isAnimationActive>
            {rows.map((row, idx) => {
              if (row.isEndpoint) {
                // Amber for base/prediction
                return <Cell key={idx} fill={row.name === 'Prediction' ? '#f59e0b' : '#6366f1'} />;
              }
              return (
                <Cell
                  key={idx}
                  fill={row.positive ? '#ef4444' : '#3b82f6'}
                  fillOpacity={0.85}
                />
              );
            })}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-5 justify-center mt-2">
        <LegendDot color="#6366f1" label="Base value" />
        <LegendDot color="#ef4444" label="Pushes error up" />
        <LegendDot color="#3b82f6" label="Pushes error down" />
        <LegendDot color="#f59e0b" label="Prediction" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
      <span className="text-gray-500 text-[10px]">{label}</span>
    </div>
  );
}
