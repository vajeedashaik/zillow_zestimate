'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';

const PIPELINE_STEPS = [
  { id: 1, icon: '📥', label: 'Load CSV', detail: '2.9M rows', color: 'border-blue-500/40 bg-blue-500/5 text-blue-400' },
  { id: 2, icon: '✂️', label: 'Chunk', detail: '50K rows each', color: 'border-cyan-500/40 bg-cyan-500/5 text-cyan-400' },
  { id: 3, icon: '⚙️', label: 'Feature Engineering', detail: '12 features', color: 'border-purple-500/40 bg-purple-500/5 text-purple-400' },
  { id: 4, icon: '🗺️', label: 'Cluster Assignment', detail: 'k=25 KMeans', color: 'border-indigo-500/40 bg-indigo-500/5 text-indigo-400' },
  { id: 5, icon: '🎯', label: 'Target Encoding', detail: 'CV 5-fold', color: 'border-amber-500/40 bg-amber-500/5 text-amber-400' },
  { id: 6, icon: '🧠', label: 'Ensemble Predict', detail: 'XGB+LGB+CAT+Ridge', color: 'border-orange-500/40 bg-orange-500/5 text-orange-400' },
  { id: 7, icon: '💾', label: 'Save Parquet', detail: 'Columnar format', color: 'border-green-500/40 bg-green-500/5 text-green-400' },
  { id: 8, icon: '⚡', label: 'Fast Lookup', detail: 'By parcelid', color: 'border-rose-500/40 bg-rose-500/5 text-rose-400' },
];

const SAMPLE_OUTPUT = [
  { parcelid: '10754147', logerror: '+0.0782', conf_low: '+0.0602', conf_high: '+0.0962', county: 'LA', cluster_id: 3 },
  { parcelid: '10759547', logerror: '-0.0341', conf_low: '-0.0521', conf_high: '-0.0161', county: 'Orange', cluster_id: 11 },
  { parcelid: '10769585', logerror: '+0.0124', conf_low: '-0.0056', conf_high: '+0.0304', county: 'LA', cluster_id: 7 },
  { parcelid: '10776953', logerror: '-0.0823', conf_low: '-0.1003', conf_high: '-0.0643', county: 'Ventura', cluster_id: 22 },
  { parcelid: '10786030', logerror: '+0.0512', conf_low: '+0.0332', conf_high: '+0.0692', county: 'Orange', cluster_id: 15 },
];

const MOCK_CSV_CONTENT = `parcelid,logerror,confidence_low,confidence_high,county,cluster_id
10754147,0.0782,0.0602,0.0962,LA,3
10759547,-0.0341,-0.0521,-0.0161,Orange,11
10769585,0.0124,-0.0056,0.0304,LA,7
10776953,-0.0823,-0.1003,-0.0643,Ventura,22
10786030,0.0512,0.0332,0.0692,Orange,15
`;

function downloadCsv() {
  const blob = new Blob([MOCK_CSV_CONTENT], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_predictions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function PipelinePage() {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  // Animate progress bar on mount
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 0;
        return p + 0.4;
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((s) => (s + 1) % PIPELINE_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/40 px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium uppercase tracking-wider">Batch Scoring Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">How 2.9M Properties Are Scored</h1>
          <p className="text-gray-500 text-sm">
            Visual explainer of the end-to-end batch scoring architecture — from raw CSV to fast parcelid lookup.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Pipeline diagram */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-6">Pipeline Stages</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PIPELINE_STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`rounded-xl border px-4 py-3 text-center transition-all duration-500 ${step.color} ${
                    activeStep === idx ? 'shadow-lg scale-105' : 'opacity-70'
                  }`}
                  style={{ minWidth: 110 }}
                >
                  <div className="text-xl mb-1">{step.icon}</div>
                  <div className="text-xs font-semibold">{step.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{step.detail}</div>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <svg width="20" height="16" viewBox="0 0 24 12" fill="none" stroke="#374151" strokeWidth="2">
                    <line x1="0" y1="6" x2="18" y2="6" />
                    <polyline points="12 0 18 6 12 12" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats + animated progress */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Chunks', value: '58', sub: '× 50K rows' },
            { label: 'Estimated Runtime', value: '~12 min', sub: 'on 8-core CPU' },
            { label: 'Output Size', value: '~180 MB', sub: 'Parquet compressed' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold font-mono text-white mb-1">{s.value}</div>
              <div className="text-gray-400 text-sm font-medium">{s.label}</div>
              <div className="text-gray-600 text-xs">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Animated progress bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Batch Scoring Simulation</h3>
            <span className="text-amber-400 font-mono text-xs">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
            <span>Chunk {Math.floor(progress / 100 * 58) + 1} of 58</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Running…
            </span>
          </div>
        </div>

        {/* Output schema */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Output Schema</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Column', 'Type', 'Description'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs">
                {[
                  { col: 'parcelid', type: 'string', desc: 'Unique property identifier' },
                  { col: 'logerror', type: 'float32', desc: 'Predicted log(Zestimate) − log(SalePrice)' },
                  { col: 'confidence_low', type: 'float32', desc: 'Lower bound of 90% prediction interval' },
                  { col: 'confidence_high', type: 'float32', desc: 'Upper bound of 90% prediction interval' },
                  { col: 'county', type: 'string', desc: 'County code: LA / Orange / Ventura' },
                  { col: 'cluster_id', type: 'int8', desc: 'KMeans spatial cluster (0–24)' },
                ].map((row, i) => (
                  <tr key={row.col} className={`border-b border-gray-800/50 ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}>
                    <td className="px-4 py-2"><code className="text-amber-400 font-mono">{row.col}</code></td>
                    <td className="px-4 py-2"><code className="text-blue-400 font-mono">{row.type}</code></td>
                    <td className="px-4 py-2 text-gray-400">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sample output table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Sample Output (5 rows)</h3>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download sample CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800">
                  {['parcelid', 'logerror', 'conf_low', 'conf_high', 'county', 'cluster_id'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_OUTPUT.map((row, i) => (
                  <tr key={row.parcelid} className={`border-b border-gray-800/50 ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}>
                    <td className="px-3 py-2 text-gray-400">{row.parcelid}</td>
                    <td className={`px-3 py-2 font-semibold ${parseFloat(row.logerror) > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {row.logerror}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.conf_low}</td>
                    <td className="px-3 py-2 text-gray-500">{row.conf_high}</td>
                    <td className="px-3 py-2 text-gray-400">{row.county}</td>
                    <td className="px-3 py-2 text-gray-400">{row.cluster_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fast lookup note */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5">
          <div className="flex gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <div>
              <div className="text-green-300 font-semibold text-sm mb-1">Fast Lookup at Inference Time</div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Once the Parquet file is generated, any property can be looked up by <code className="text-green-400 font-mono text-xs">parcelid</code> in under 1ms using pandas or DuckDB. The batch run only needs to happen once — or be re-triggered on new data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
