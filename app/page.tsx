import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import ProblemStatement from '@/components/ProblemStatement';
import DataOverview from '@/components/DataOverview';
import Pipeline from '@/components/Pipeline';
import FeatureEngineeringSection from '@/components/FeatureEngineeringSection';
import CountyAnalysis from '@/components/CountyAnalysis';
import ModelComparison from '@/components/ModelComparison';
import StackingSection from '@/components/StackingSection';
import SHAPSection from '@/components/SHAPSection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <Hero />
      <ProblemStatement />
      <DataOverview />
      <Pipeline />
      <FeatureEngineeringSection />
      <CountyAnalysis />
      <ModelComparison />
      <StackingSection />
      <SHAPSection />

      {/* CTA strip */}
      <section className="bg-gray-900 border-b border-gray-800 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Try the interactive tools</h2>
          <p className="text-gray-500 mb-8 text-sm">
            Input any property and get a live logerror prediction, SHAP explanation, and buyer/seller risk assessment.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { href: '/demo', label: 'Live Prediction Demo', accent: true, sub: 'Most polished — start here' },
              { href: '/risk-checker', label: 'Buyer/Seller Risk Checker', sub: 'Plain-English advice' },
              { href: '/explainer', label: 'SHAP Explainer', sub: 'Per-feature waterfall' },
              { href: '/heatmap', label: 'Geo Heatmap', sub: '12,500 properties mapped' },
              { href: '/monitoring', label: 'Model Monitoring', sub: 'Drift detection' },
              { href: '/pipeline', label: 'Batch Pipeline', sub: 'Architecture diagram' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`px-5 py-3 rounded-xl border text-center transition-all ${
                  link.accent
                    ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 text-amber-300'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
                }`}
              >
                <div className="font-semibold text-sm">{link.label}</div>
                <div className="text-xs mt-0.5 opacity-60">{link.sub}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
