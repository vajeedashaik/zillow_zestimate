'use client';

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
} from 'recharts';

const waterfallItems = [
  { name: 'Base Value', value: 0.0521, isBase: true },
  { name: 'tax_ratio', value: 0.0183, isPositive: true, tooltip: 'High tax relative to value — pushed logerror up' },
  { name: 'geo_cluster_te', value: 0.0142, isPositive: true, tooltip: 'This cluster historically overestimated' },
  { name: 'property_age', value: -0.0097, isPositive: false, tooltip: 'Older home — slight correction downward' },
  { name: 'living_area_ratio', value: 0.0061, isPositive: true, tooltip: 'Dense living area vs lot size' },
  { name: 'county_te', value: 0.0044, isPositive: true, tooltip: 'LA county on average overestimated' },
];

const FINAL = 0.0854;

export default function SHAPSection() {
  return (
    <section className="bg-gray-900/30 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">SHAP Explainability</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">Why did Zillow overestimate this Pasadena property by ~9%?</h2>
          <p className="text-gray-500 text-sm">XGBoost TreeExplainer · Pasadena, LA County · logerror = +0.0854</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Waterfall chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-1">SHAP Waterfall</h3>
            <p className="text-gray-500 text-xs mb-5">
              Red bars push logerror up (overestimate) · Blue bars push it down
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                layout="vertical"
                data={waterfallItems}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-0.02, 0.06]}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickFormatter={(v: number) => v.toFixed(3)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#d1d5db', fontSize: 12 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(value: number) => [
                    `${value > 0 ? '+' : ''}${value.toFixed(4)}`,
                    'SHAP contribution',
                  ]}
                />
                <ReferenceLine x={0} stroke="#4b5563" />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {waterfallItems.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.isBase
                          ? '#6b7280'
                          : entry.isPositive
                          ? '#ef4444'
                          : '#3b82f6'
                      }
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Base → final annotation */}
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-gray-500" />
                <span className="text-gray-500">Base: <span className="font-mono text-gray-300">0.0521</span></span>
              </div>
              <svg width="16" height="12" viewBox="0 0 24 12" fill="none" stroke="#4b5563" strokeWidth="2">
                <line x1="0" y1="6" x2="20" y2="6" />
                <polyline points="14 0 20 6 14 12" />
              </svg>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Final: <span className="font-mono text-amber-300 font-bold">{FINAL}</span></span>
                <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-0.5">OVERPRICED</span>
              </div>
            </div>
          </div>

          {/* Feature breakdown table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Feature Contributions</h3>
            <div className="space-y-3">
              {waterfallItems.map((item) => (
                <div key={item.name} className="flex items-start gap-3">
                  <div
                    className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                      item.isBase ? 'bg-gray-500' : item.isPositive ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <code className="text-xs text-gray-300 font-mono">{item.name}</code>
                      <span
                        className={`text-xs font-mono font-bold ${
                          item.isBase
                            ? 'text-gray-400'
                            : item.isPositive
                            ? 'text-red-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {item.isPositive ? '+' : ''}{item.value.toFixed(4)}
                      </span>
                    </div>
                    {item.tooltip && (
                      <p className="text-gray-600 text-xs">{item.tooltip}</p>
                    )}
                    {/* Mini bar */}
                    <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.isBase ? 'bg-gray-500' : item.isPositive ? 'bg-red-500/60' : 'bg-blue-500/60'
                        }`}
                        style={{ width: `${Math.abs(item.value) / 0.055 * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
                <span className="text-gray-400 text-sm font-medium">Final Prediction</span>
                <div className="text-right">
                  <div className="text-amber-400 font-mono font-bold">+{FINAL}</div>
                  <div className="text-gray-600 text-xs">≈ 9% overestimate</div>
                </div>
              </div>
            </div>

            {/* What it means */}
            <div className="mt-5 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <div className="text-red-300 text-xs font-semibold mb-1">What this means</div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Zillow&apos;s estimate for this Pasadena property is likely <strong className="text-white">~9% too high</strong>. The main drivers are the high tax ratio and the cluster&apos;s historical tendency to be overestimated. Buyers should negotiate below Zestimate.
              </p>
            </div>

            {/* Explore more */}
            <a
              href="/explainer"
              className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors border border-gray-700"
            >
              Try SHAP Explainer for any property →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
