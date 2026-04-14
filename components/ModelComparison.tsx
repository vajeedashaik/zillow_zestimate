'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { modelJourney, modelResults } from '@/data/mockData';

const BASELINE = 0.0791;
const BEST = 0.0742;
const DELTA_PCT = (((BASELINE - BEST) / BASELINE) * 100).toFixed(1);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (payload.isEnsemble) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill="#f59e0b" fillOpacity={0.2} stroke="#f59e0b" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={4} fill="#f59e0b" />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill="#60a5fa" stroke="#1e3a5f" strokeWidth={1} />;
}

export default function ModelComparison() {
  return (
    <section className="bg-gray-900/30 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Model Comparison</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">The Modelling Journey</h2>
          <p className="text-gray-500 text-sm">6 models · 5-fold cross-validation · RMSE on logerror</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Line chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">RMSE Improvement Journey</h3>
              <span className="text-xs font-mono bg-green-500/10 text-green-400 border border-green-500/30 rounded-full px-3 py-1">
                −{DELTA_PCT}% vs baseline
              </span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={modelJourney} margin={{ top: 20, right: 30, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="model" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  domain={[0.073, 0.081]}
                  tickFormatter={(v: number) => v.toFixed(4)}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff', fontWeight: 600 }}
                  formatter={(value: number) => [value.toFixed(4), 'CV RMSE']}
                />
                {/* Baseline reference */}
                <ReferenceLine
                  y={BASELINE}
                  stroke="#ef4444"
                  strokeDasharray="5 4"
                  label={{ value: 'Ridge baseline', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                />
                {/* Best reference */}
                <ReferenceLine
                  y={BEST}
                  stroke="#f59e0b"
                  strokeDasharray="5 4"
                  label={{ value: 'Ensemble best', fill: '#f59e0b', fontSize: 10, position: 'insideBottomRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="rmse"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={{ r: 5, fill: '#60a5fa' }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-gray-600 text-xs mt-3 text-center">
              ★ Amber dot = OOF Stacking — best result
            </p>
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Model Results (5-fold CV)</h3>
            <div className="overflow-hidden rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Model</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400">CV RMSE</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 hidden sm:table-cell">Train Time</th>
                  </tr>
                </thead>
                <tbody>
                  {modelResults.map((r, i) => (
                    <tr
                      key={r.model}
                      className={`border-b border-gray-800/60 transition-colors ${
                        r.isEnsemble
                          ? 'bg-amber-500/5 border-b-amber-500/20'
                          : i % 2 === 0
                          ? 'bg-gray-900/60'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {r.isEnsemble && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          )}
                          <span className={r.isEnsemble ? 'text-amber-300 font-semibold' : 'text-gray-300'}>
                            {r.model}
                          </span>
                          {r.isEnsemble && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5">BEST</span>
                          )}
                        </div>
                        <div className="text-gray-600 text-xs mt-0.5 pl-3.5">{r.notes}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-mono font-bold text-sm ${r.isEnsemble ? 'text-amber-400' : 'text-gray-300'}`}>
                          {r.cvRmse.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500 hidden sm:table-cell">
                        {r.trainTime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
