'use client';

/**
 * ShapBarChart.tsx
 *
 * Horizontal bar chart showing SHAP feature importances ranked by
 * absolute value. Red = positive SHAP (pushes error up),
 * blue = negative SHAP (pushes error down).
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import type { ShapFeature } from '@/lib/shapMock';

interface ShapBarChartProps {
  features: ShapFeature[];
}

interface BarRow {
  label: string;
  rawValue: string;
  shapValue: number;
  absShap: number;
}

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: BarRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const sign = row.shapValue >= 0;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl max-w-xs">
      <p className="text-gray-200 font-semibold mb-1">{row.label}</p>
      <p className="text-gray-400 mb-1">Feature value: <span className="text-gray-200 font-mono">{row.rawValue}</span></p>
      <p className={`font-mono font-bold ${sign ? 'text-red-400' : 'text-blue-400'}`}>
        SHAP: {sign ? '+' : ''}{row.shapValue.toFixed(5)}
      </p>
      <p className="text-gray-500 mt-1">
        {sign ? 'Increases predicted logerror' : 'Decreases predicted logerror'}
      </p>
    </div>
  );
}

export default function ShapBarChart({ features }: ShapBarChartProps) {
  // Already sorted by |shapValue| desc from shapMock; reverse for bottom-to-top display
  const rows: BarRow[] = [...features]
    .slice(0, 9)
    .reverse()
    .map((f) => ({
      label:     f.label,
      rawValue:  f.rawValue,
      shapValue: f.shapValue,
      absShap:   Math.abs(f.shapValue),
    }));

  // Symmetric x-axis
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.shapValue)));
  const xDom   = maxAbs * 1.25 || 0.01;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 4, right: 64, left: 8, bottom: 4 }}
          barCategoryGap="22%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[-xDom, xDom]}
            tickFormatter={(v: number) => (v >= 0 ? '+' : '') + v.toFixed(3)}
            tick={{ fill: '#6b7280', fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={148}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1} />

          <Bar dataKey="shapValue" maxBarSize={20} radius={[0, 2, 2, 0]} isAnimationActive>
            {rows.map((row, idx) => (
              <Cell
                key={idx}
                fill={row.shapValue >= 0 ? '#ef4444' : '#3b82f6'}
                fillOpacity={0.85}
              />
            ))}
            <LabelList
              dataKey="rawValue"
              position="right"
              style={{ fill: '#6b7280', fontSize: 9 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-5 justify-center mt-1">
        <LegendDot color="#ef4444" label="Positive SHAP (overestimation)" />
        <LegendDot color="#3b82f6" label="Negative SHAP (underestimation)" />
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
