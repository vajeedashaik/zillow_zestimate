export default function StackingSection() {
  return (
    <section className="bg-gray-950 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Stacking Ensemble</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Explanation */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Out-of-Fold Stacking</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Instead of training a single model, we train four base models (Ridge, XGBoost, LightGBM, CatBoost) using 5-fold cross-validation. Each model produces <span className="text-white font-medium">out-of-fold (OOF) predictions</span> — predictions on data it never saw during training.
            </p>
            <p className="text-gray-400 leading-relaxed mb-4">
              These OOF predictions become the <span className="text-white font-medium">meta-features</span> fed into a Ridge regression meta-model. Because the OOF predictions are never contaminated by the training target, there is <span className="text-green-400">no data leakage</span>.
            </p>
            <p className="text-gray-400 leading-relaxed mb-6">
              The meta-model learns which base models to trust for different property types, resulting in a final RMSE of <span className="text-amber-400 font-mono font-bold">0.0742</span> — a {(((0.0791 - 0.0742) / 0.0791) * 100).toFixed(1)}% improvement over the Ridge baseline.
            </p>

            {/* Key benefits */}
            <div className="space-y-3">
              {[
                { title: 'No data leakage', desc: 'OOF ensures base models never see their own training labels', color: 'text-green-400' },
                { title: 'Diversity', desc: 'Each base model captures different patterns (linear, tree, boosting)', color: 'text-blue-400' },
                { title: 'Robustness', desc: 'Meta-model down-weights unreliable base predictions automatically', color: 'text-purple-400' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 items-start">
                  <div className={`w-1 h-1 rounded-full mt-2 flex-shrink-0 ${item.color === 'text-green-400' ? 'bg-green-400' : item.color === 'text-blue-400' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                  <div>
                    <span className={`text-sm font-medium ${item.color}`}>{item.title}</span>
                    <span className="text-gray-500 text-sm"> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual diagram */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-6">Stacking Architecture</h3>

            {/* Level 1: Base models */}
            <div className="mb-2">
              <div className="text-xs text-gray-600 mb-2 text-center">Level 1 — Base Models (5-fold OOF)</div>
              <div className="grid grid-cols-4 gap-2">
                {['Ridge', 'XGBoost', 'LightGBM', 'CatBoost'].map((m) => (
                  <div key={m} className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-300 font-medium">{m}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center my-3">
              <div className="flex flex-col items-center gap-1">
                <div className="text-gray-600 text-xs">OOF predictions</div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </div>
            </div>

            {/* Level 2: Meta features */}
            <div className="mb-2">
              <div className="text-xs text-gray-600 mb-2 text-center">Meta-features matrix (4 columns)</div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                <div className="font-mono text-xs text-gray-500 space-y-1">
                  <div className="flex gap-2 text-gray-600 text-xs border-b border-gray-700 pb-1">
                    <span className="w-16">parcel</span>
                    <span className="w-16">ridge_oof</span>
                    <span className="w-16">xgb_oof</span>
                    <span className="w-16">lgb_oof</span>
                    <span className="w-16">cat_oof</span>
                  </div>
                  {[
                    ['...1001', '+0.083', '+0.079', '+0.081', '+0.082'],
                    ['...1002', '-0.041', '-0.038', '-0.040', '-0.039'],
                    ['...1003', '+0.012', '+0.009', '+0.011', '+0.010'],
                  ].map((row, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="w-16 text-gray-600">{row[0]}</span>
                      {row.slice(1).map((v, j) => (
                        <span key={j} className={`w-16 ${parseFloat(v) > 0 ? 'text-red-400' : 'text-blue-400'}`}>{v}</span>
                      ))}
                    </div>
                  ))}
                  <div className="text-gray-700 text-xs pt-1">… 90K rows</div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center my-3">
              <div className="flex flex-col items-center gap-1">
                <div className="text-gray-600 text-xs">Ridge regression</div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </div>
            </div>

            {/* Final output */}
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3 text-center">
              <div className="text-amber-400 font-semibold text-sm">Meta-model output</div>
              <div className="text-gray-400 text-xs mt-1">Final logerror prediction · RMSE <span className="font-mono text-amber-300">0.0742</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
