import { pipelineSteps } from '@/data/mockData';

const iconPaths: Record<string, string> = {
  database: 'M12 2C6.48 2 2 4.24 2 7s4.48 5 10 5 10-2.24 10-5-4.48-5-10-5zM2 7v5c0 2.76 4.48 5 10 5s10-2.24 10-5V7M2 12v5c0 2.76 4.48 5 10 5s10-2.24 10-5v-5',
  'bar-chart': 'M18 20V10M12 20V4M6 20v-6',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  cpu: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  'map-pin': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  'git-merge': 'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21V9a9 9 0 0 0 9 9',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  'trending-up': 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};

const categoryColors: Record<number, string> = {
  1: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
  2: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  3: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  4: 'border-green-500/30 bg-green-500/5 text-green-400',
  5: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
};

export default function Pipeline() {
  return (
    <section className="bg-gray-950 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">ML Pipeline</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">12-Step Modelling Pipeline</h2>
          <p className="text-gray-500 text-sm">From raw CSV to stacked ensemble predictions</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelineSteps.map((step) => {
            const colorIdx = Math.ceil(step.step / 2.5);
            const colorClass = categoryColors[Math.min(colorIdx, 5)];
            const iconD = iconPaths[step.icon] || iconPaths.zap;
            return (
              <div
                key={step.step}
                className={`rounded-xl border p-4 flex gap-4 items-start ${colorClass}`}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={iconD} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-600">#{step.step}</span>
                    <span className="text-sm font-semibold text-white truncate">{step.title}</span>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Final arrow */}
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-3 bg-gray-900 border border-amber-500/30 rounded-xl px-6 py-3">
            <span className="text-xs text-gray-500">Output:</span>
            <code className="text-amber-400 text-sm font-mono">logerror prediction + confidence interval + SHAP attribution</code>
          </div>
        </div>
      </div>
    </section>
  );
}
