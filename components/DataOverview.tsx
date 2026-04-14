export default function DataOverview() {
  return (
    <section className="bg-gray-900/40 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Data Overview</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Files */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Dataset Files
            </h3>
            <div className="space-y-3">
              {[
                { file: 'properties_2016.csv', size: '~2.9M rows', desc: 'Raw property features for all LA-area parcels' },
                { file: 'train_2016.csv', size: '~90K rows', desc: 'Transactions with logerror labels' },
              ].map((f) => (
                <div key={f.file} className="border border-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-amber-400 text-xs font-mono">{f.file}</code>
                    <span className="text-xs text-gray-600 bg-gray-800 rounded px-2 py-0.5">{f.size}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Counties */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Geographic Coverage
            </h3>
            <div className="space-y-3">
              {[
                { county: 'Los Angeles', fips: '6037', count: '~2.1M', color: 'text-amber-400' },
                { county: 'Orange County', fips: '6059', count: '~580K', color: 'text-blue-400' },
                { county: 'Ventura County', fips: '6111', count: '~220K', color: 'text-purple-400' },
              ].map((c) => (
                <div key={c.fips} className="flex items-center justify-between border border-gray-800 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${c.color === 'text-amber-400' ? 'bg-amber-400' : c.color === 'text-blue-400' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                    <span className="text-gray-300 text-sm">{c.county}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <code className="text-gray-600 font-mono">FIPS {c.fips}</code>
                    <span className={`font-mono font-semibold ${c.color}`}>{c.count}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-3">Southern California · 2016 transactions</p>
          </div>

          {/* Key stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Key Statistics
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Raw features', value: '58', sub: 'before engineering' },
                { label: 'After multicollinearity pruning', value: '~40', sub: 'corr >0.95 removed' },
                { label: 'Engineered features', value: '12', sub: 'added to pipeline' },
                { label: 'Spatial clusters (KMeans)', value: '25', sub: 'k=25 on lat/lon' },
                { label: 'CV folds (all models)', value: '5', sub: 'StratifiedKFold' },
                { label: 'Optuna trials (LightGBM)', value: '20', sub: 'Bayesian tuning' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-400 text-xs">{s.label}</div>
                    <div className="text-gray-600 text-xs">{s.sub}</div>
                  </div>
                  <span className="text-white font-mono font-bold text-sm">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
