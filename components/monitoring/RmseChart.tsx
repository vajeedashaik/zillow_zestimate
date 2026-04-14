'use client';

/**
 * components/monitoring/RmseChart.tsx
 *
 * Rolling weekly RMSE line chart over 52 weeks.
 * Shows a dashed alert threshold at 0.08 and colours
 * the line amber → red as it approaches/crosses the limit.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { RmseDataPoint } from '@/data/mockMonitoringData';

interface Props {
  data: RmseDataPoint[];
}

const monthLabels: Record<number, string> = {
  1: 'Jan', 5: 'Feb', 9: 'Mar', 14: 'Apr', 18: 'May', 22: 'Jun',
  27: 'Jul', 31: 'Aug', 36: 'Sep', 40: 'Oct', 44: 'Nov', 49: 'Dec',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const rmse = payload[0]?.value as number;
  const isAlert = rmse >= 0.08;
  const isWarn  = rmse >= 0.075 && rmse < 0.08;
  const color   = isAlert ? '#ef4444' : isWarn ? '#f59e0b' : '#22c55e';
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      <p style={{ color }} className="font-semibold">RMSE: {rmse.toFixed(4)}</p>
      {isAlert && <p className="text-red-400 mt-0.5">⚠ Above alert threshold</p>}
      {isWarn  && <p className="text-amber-400 mt-0.5">⚡ Approaching threshold</p>}
    </div>
  );
}

export default function RmseChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="week"
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: '#374151' }}
          interval={0}
          tickFormatter={(v, i) => {
            const w = parseInt(v.replace('W', ''), 10);
            return monthLabels[w] ?? '';
          }}
        />
        <YAxis
          domain={[0.068, 0.092]}
          tickFormatter={(v) => v.toFixed(3)}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={0.08}
          stroke="#ef4444"
          strokeDasharray="5 3"
          strokeWidth={1.5}
          label={{ value: 'Alert 0.080', position: 'right', fill: '#ef4444', fontSize: 10 }}
        />
        <ReferenceLine
          y={0.0742}
          stroke="#6b7280"
          strokeDasharray="3 3"
          strokeWidth={1}
          label={{ value: 'Baseline 0.0742', position: 'right', fill: '#6b7280', fontSize: 9 }}
        />
        <Line
          type="monotone"
          dataKey="rmse"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#f59e0b', stroke: '#1f2937', strokeWidth: 2 }}
          name="Weekly RMSE"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
