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
import { countyStats, ageGroupStats } from '@/data/mockData';

const countyColors: Record<string, string> = {
  LA: '#f59e0b',
  Orange: '#60a5fa',
  Ventura: '#a78bfa',
};

const ageColors = ['#f87171', '#fb923c', '#60a5fa', '#818cf8'];

export default function CountyAnalysis() {
  return (
    <section className="bg-gray-950 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">County Error Analysis</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">How do errors vary by county and property age?</h2>
          <p className="text-gray-500 text-sm">Mean logerror per county and age bucket — reference line at 0 (perfect accuracy)</p>
        </div>

        {/* Insight callout */}
        <div className="mb-8 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <p className="text-amber-200 text-sm">
            <span className="font-semibold">Key insight: </span>
            LA properties are systematically overestimated; older homes tend to be underestimated by Zillow.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* County chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-1">Mean Logerror by County</h3>
            <p className="text-gray-500 text-xs mb-5">Positive = overestimated on average</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={countyStats} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="county" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v: number) => v.toFixed(3)}
                  domain={[-0.02, 0.025]}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [value.toFixed(4), 'Mean logerror']}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '0 (perfect)', fill: '#6b7280', fontSize: 10 }} />
                <Bar dataKey="meanLogerror" radius={[4, 4, 0, 0]}>
                  {countyStats.map((entry) => (
                    <Cell
                      key={entry.code}
                      fill={countyColors[entry.code]}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex gap-4 mt-3 justify-center">
              {countyStats.map((c) => (
                <div key={c.code} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: countyColors[c.code] }} />
                  {c.county}
                </div>
              ))}
            </div>
          </div>

          {/* Age bucket chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-1">Mean Logerror by Property Age</h3>
            <p className="text-gray-500 text-xs mb-5">Older homes are more often underestimated</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ageGroupStats} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="bucket" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v: number) => v.toFixed(3)}
                  domain={[-0.028, 0.030]}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [value.toFixed(4), 'Mean logerror']}
                />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '0', fill: '#6b7280', fontSize: 10 }} />
                <Bar dataKey="meanLogerror" radius={[4, 4, 0, 0]}>
                  {ageGroupStats.map((_, i) => (
                    <Cell key={i} fill={ageColors[i]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {ageGroupStats.map((a, i) => (
                <div key={a.bucket} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ageColors[i] }} />
                  {a.bucket}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Annotation rows */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {countyStats.map((c) => (
            <div key={c.code} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 flex items-center justify-between">
              <span className="text-gray-400 text-sm">{c.county}</span>
              <div className="text-right">
                <span
                  className={`font-mono font-bold text-sm ${
                    c.meanLogerror > 0 ? 'text-red-400' : c.meanLogerror < 0 ? 'text-blue-400' : 'text-gray-400'
                  }`}
                >
                  {c.meanLogerror > 0 ? '+' : ''}{c.meanLogerror.toFixed(4)}
                </span>
                <div className="text-gray-600 text-xs">
                  {c.meanLogerror > 0 ? 'avg overestimate' : c.meanLogerror < 0 ? 'avg underestimate' : 'accurate'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
