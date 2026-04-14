import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <span className="font-semibold text-sm text-white">
                Zestimate<span className="text-amber-400">ML</span>
              </span>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              Predicting Zillow residual logerror across 2.9M Southern California properties using an ensemble of gradient boosting models with SHAP explainability.
            </p>
          </div>

          {/* Dataset */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dataset</h4>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>properties_2016.csv — 2.9M rows</li>
              <li>train_2016.csv — 90K transactions</li>
              <li>FIPS 6037 (Los Angeles)</li>
              <li>FIPS 6059 (Orange County)</li>
              <li>FIPS 6111 (Ventura County)</li>
              <li className="text-gray-600 pt-1">Kaggle Zillow Prize Competition</li>
            </ul>
          </div>

          {/* Pages */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pages</h4>
            <ul className="space-y-1.5 text-xs">
              {[
                { href: '/demo', label: 'Live Prediction Demo', accent: true },
                { href: '/risk-checker', label: 'Buyer/Seller Risk Checker' },
                { href: '/explainer', label: 'SHAP Explainer' },
                { href: '/heatmap', label: 'Geo Heatmap' },
                { href: '/monitoring', label: 'Model Monitoring' },
                { href: '/pipeline', label: 'Batch Pipeline' },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`hover:text-white transition-colors ${l.accent ? 'text-amber-400' : 'text-gray-500'}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-600 text-xs">
            Best Ensemble RMSE: <span className="text-amber-400 font-mono">0.0742</span> · OOF Stacking (XGBoost + LightGBM + CatBoost → Ridge meta-model)
          </p>
          <p className="text-gray-700 text-xs">Student Project Expo · 2024</p>
        </div>
      </div>
    </footer>
  );
}
