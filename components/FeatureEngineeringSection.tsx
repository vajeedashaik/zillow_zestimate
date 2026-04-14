import { engineeredFeatures, type FeatureDefinition } from '@/data/mockData';

const categoryConfig: Record<FeatureDefinition['category'], { label: string; color: string; bg: string }> = {
  temporal: { label: 'Temporal', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  financial: { label: 'Financial', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  spatial: { label: 'Spatial', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  interaction: { label: 'Interaction', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
};

export default function FeatureEngineeringSection() {
  return (
    <section className="bg-gray-900/30 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Feature Engineering</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">12 Engineered Features</h2>
          <p className="text-gray-500 text-sm">Domain knowledge transformed into model-ready inputs</p>
        </div>

        {/* Category legend */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {(Object.entries(categoryConfig) as [FeatureDefinition['category'], typeof categoryConfig[FeatureDefinition['category']]][]).map(([key, cfg]) => (
            <span key={key} className={`text-xs px-3 py-1 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          ))}
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {engineeredFeatures.map((feat) => {
            const cfg = categoryConfig[feat.category];
            return (
              <div key={feat.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <code className="text-amber-300 text-sm font-mono font-semibold">{feat.name}</code>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="bg-gray-800/60 rounded-lg px-3 py-1.5 mb-2">
                  <code className="text-gray-400 text-xs font-mono">{feat.formula}</code>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>

        {/* Note */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-gray-500 text-sm">
            <span className="text-gray-300 font-medium">Target encoding (geo_cluster_te, county_te)</span> uses 5-fold cross-validation to prevent data leakage. Cluster assignments from KMeans are frozen at training time and reused at inference.
          </p>
        </div>
      </div>
    </section>
  );
}
