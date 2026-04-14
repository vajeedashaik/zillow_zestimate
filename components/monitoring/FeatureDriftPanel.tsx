'use client';

/**
 * components/monitoring/FeatureDriftPanel.tsx
 *
 * For each of the 5 monitored features, renders a small histogram
 * comparing baseline vs. current-month distribution.
 * Features with PSI > 0.2 are highlighted with a red/amber border.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { FeatureDrift } from '@/data/mockMonitoringData';

interface Props {
  features: FeatureDrift[];
  drifted: boolean;
}

function psiColor(psi: number) {
  if (psi > 0.2)  return { border: 'border-red-500/60',  badge: 'bg-red-500/15 text-red-400 border-red-500/40',  label: 'ALERT' };
  if (psi > 0.1)  return { border: 'border-amber-500/60',badge: 'bg-amber-500/15 text-amber-400 border-amber-500/40', label: 'WARN' };
  return           { border: 'border-gray-700',           badge: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'OK' };
}

function FeatureCard({ feature, drifted }: { feature: FeatureDrift; drifted: boolean }) {
  const activePsi  = drifted ? feature.psiDrifted : feature.psi;
  const activeBins = drifted ? feature.binsDrifted : feature.bins;
  const { border, badge, label } = psiColor(activePsi);

  return (
    <div className={`bg-gray-900/70 border ${border} rounded-xl p-4 flex flex-col gap-2 transition-colors duration-500`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-semibold">{feature.label}</p>
          {feature.unit && (
            <p className="text-gray-500 text-xs">{feature.unit}</p>
          )}
        </div>
        <div className={`flex items-center gap-1.5 text-xs border rounded-md px-2 py-0.5 font-semibold ${badge}`}>
          {label !== 'OK' && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          <span>PSI {activePsi.toFixed(2)}</span>
          <span className="text-current/70">· {label}</span>
        </div>
      </div>

      {/* Histogram */}
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={activeBins} barCategoryGap="15%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="bin"
            tick={{ fill: '#4b5563', fontSize: 8 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            interval={Math.floor(activeBins.length / 4)}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(v: number, name: string) => [v.toFixed(2) + '%', name]}
          />
          <Bar dataKey="baseline" name="Baseline" fill="#6b7280" radius={[2, 2, 0, 0]} />
          <Bar dataKey="current"  name="Current"  fill={activePsi > 0.2 ? '#ef4444' : activePsi > 0.1 ? '#f59e0b' : '#3b82f6'} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-gray-500 inline-block" /> Baseline
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-3 h-2 rounded-sm inline-block ${activePsi > 0.2 ? 'bg-red-500' : activePsi > 0.1 ? 'bg-amber-500' : 'bg-blue-500'}`} /> Current
        </span>
      </div>
    </div>
  );
}

export default function FeatureDriftPanel({ features, drifted }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {features.map((f) => (
        <FeatureCard key={f.name} feature={f} drifted={drifted} />
      ))}
    </div>
  );
}
