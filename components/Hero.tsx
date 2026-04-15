'use client';

interface StatCard {
  value: string;
  label: string;
  color: string;
  glow: string;
}

const stats: StatCard[] = [
  { value: '2.9M', label: 'Properties Analysed', color: 'text-amber-400', glow: 'shadow-amber-500/20' },
  { value: '0.0742', label: 'CV RMSE (Best Ensemble)', color: 'text-green-400', glow: 'shadow-green-500/20' },
  { value: '6', label: 'Models Compared', color: 'text-blue-400', glow: 'shadow-blue-500/20' },
  { value: '11', label: 'Features Engineered', color: 'text-purple-400', glow: 'shadow-purple-500/20' },
  { value: '3', label: 'Counties: LA · Orange · Ventura', color: 'text-rose-400', glow: 'shadow-rose-500/20' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gray-950 border-b border-gray-800">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Glow blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Student Project Expo · Kaggle Zillow Prize Dataset
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
          Zillow Zestimate{' '}
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Residual Error
          </span>{' '}
          Prediction
        </h1>

        {/* Subline */}
        <p className="text-center text-gray-400 text-lg max-w-2xl mx-auto mb-3">
          Predicting{' '}
          <code className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded text-sm font-mono">
            logerror = log(Zestimate) − log(SalePrice)
          </code>{' '}
          for 2.9 million California properties using an ensemble of gradient boosting models.
        </p>
        <p className="text-center text-gray-500 text-sm mb-12">
          A positive logerror means Zillow <span className="text-red-400">overestimated</span> — a negative logerror means it{' '}
          <span className="text-green-400">underestimated</span>
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`bg-gray-900/80 border border-gray-800 rounded-xl p-4 text-center shadow-lg ${stat.glow} hover:border-gray-700 transition-colors`}
            >
              <div className={`text-2xl font-bold font-mono ${stat.color} mb-1`}>{stat.value}</div>
              <div className="text-gray-500 text-xs leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Cloud services status bar */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {[
            'AWS Lambda',
            'DynamoDB',
            'SNS Alerts',
            'GCP Firestore',
            'BigQuery',
            'CloudFront CDN',
          ].map((svc) => (
            <span key={svc} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
              {svc}
            </span>
          ))}
        </div>

        {/* logerror legend */}
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>logerror &gt; 0 → Overestimated (seller beware)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span>logerror ≈ 0 → Accurate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>logerror &lt; 0 → Underestimated (buyer opportunity)</span>
          </div>
        </div>
      </div>
    </section>
  );
}
