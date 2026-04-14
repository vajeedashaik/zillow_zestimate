export default function ProblemStatement() {
  return (
    <section className="bg-gray-950 py-16 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-800" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Problem Statement</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-800" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: explanation */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Why doesn&apos;t Zillow&apos;s estimate always match the sale price?
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Zillow&apos;s Zestimate is an automated valuation model (AVM) that estimates home values from public data. But it systematically makes errors — some homes are overvalued, others undervalued. These errors can cost buyers and sellers thousands of dollars.
            </p>
            <p className="text-gray-400 leading-relaxed mb-6">
              This project predicts the <span className="text-amber-300 font-mono">logerror = log(Zestimate) − log(SalePrice)</span>, the residual error of the Zestimate. By modelling what drives these errors, we can warn buyers and sellers when Zillow&apos;s estimate is likely off.
            </p>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <span className="text-gray-500">Metric:</span>
                <span className="text-white font-mono font-semibold">RMSE</span>
                <span className="text-gray-600">(lower = better)</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <span className="text-gray-500">Best:</span>
                <span className="text-green-400 font-mono font-semibold">0.0742</span>
              </div>
            </div>
          </div>

          {/* Right: three logerror cases */}
          <div className="space-y-4">
            {[
              {
                sign: '> 0',
                title: 'Overestimated',
                body: 'Zillow thinks the home is worth more than it sold for. Buyers risk overpaying; sellers have an advantage.',
                example: 'logerror = +0.085',
                color: 'border-red-500/30 bg-red-500/5',
                badge: 'text-red-400 bg-red-500/10 border-red-500/20',
                dot: 'bg-red-500',
              },
              {
                sign: '≈ 0',
                title: 'Accurate',
                body: 'Zillow\'s estimate closely matches the true sale price. Both parties can trust the number.',
                example: 'logerror = 0.003',
                color: 'border-gray-700 bg-gray-900/40',
                badge: 'text-gray-400 bg-gray-800 border-gray-700',
                dot: 'bg-gray-400',
              },
              {
                sign: '< 0',
                title: 'Underestimated',
                body: 'Zillow undervalues the home. A buyer opportunity — the home may sell above Zestimate.',
                example: 'logerror = −0.072',
                color: 'border-blue-500/30 bg-blue-500/5',
                badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                dot: 'bg-blue-500',
              },
            ].map((item) => (
              <div key={item.sign} className={`rounded-xl border p-4 ${item.color}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${item.dot}`} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">{item.title}</span>
                        <code className="text-xs font-mono text-gray-500">{item.sign}</code>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-mono border rounded px-2 py-0.5 flex-shrink-0 ${item.badge}`}>
                    {item.example}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
