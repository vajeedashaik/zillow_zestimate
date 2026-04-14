'use client';

/**
 * app/explainer/page.tsx
 *
 * SHAP Explainability page for the Zillow Zestimate showcase site.
 *
 * Flow:
 *  1. User fills in property details (or clicks "Surprise me")
 *  2. On submit, feature engineering runs client-side (replicating model.py)
 *  3. Mock SHAP explainer returns per-feature contributions
 *  4. Three visualisations: waterfall chart, importance bar chart, prediction card
 */

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import {
  computeShap,
  randomProperty,
  type PropertyInput,
  type ShapResult,
  type County,
} from '@/lib/shapMock';
import PredictionCard from '@/components/PredictionCard';

// Recharts uses browser APIs — SSR-safe dynamic import
const WaterfallChart = dynamic(() => import('@/components/WaterfallChart'), { ssr: false });
const ShapBarChart   = dynamic(() => import('@/components/ShapBarChart'),   { ssr: false });

// ────────────────────────────────────────────────────────────────────────────
// Form defaults
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_INPUT: PropertyInput = {
  yearBuilt:       1985,
  finishedSqFt:    1650,
  lotSizeSqFt:     6500,
  taxAmount:       6800,
  taxValue:        520000,
  transactionMonth: 6,
  county:          'LA',
};

const COUNTIES: { id: County; label: string; fips: string }[] = [
  { id: 'LA',      label: 'Los Angeles',  fips: '6037' },
  { id: 'Orange',  label: 'Orange',       fips: '6059' },
  { id: 'Ventura', label: 'Ventura',      fips: '6111' },
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function ExplainerPage() {
  const [input, setInput]   = useState<PropertyInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<ShapResult | null>(null);
  const [activeTab, setActiveTab] = useState<'waterfall' | 'importance'>('waterfall');

  function handleChange<K extends keyof PropertyInput>(key: K, val: PropertyInput[K]) {
    setInput((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(computeShap(input));
  }

  function handleSurprise() {
    const rp = randomProperty();
    setInput(rp);
    setResult(computeShap(rp));
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <ShapIcon />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              SHAP Explainer
            </h1>
            <p className="text-gray-500 text-xs">
              Per-property logerror breakdown · XGBoost TreeExplainer
            </p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 text-sm hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800 border border-transparent hover:border-gray-700"
          >
            Heatmap
          </Link>
          <span className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm font-medium">
            Explainer
          </span>
          <Link
            href="/monitoring"
            className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <polyline points="6 9 9 12 13 8 17 13" />
            </svg>
            Monitoring
          </Link>
        </nav>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Input panel ──────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 border-r border-gray-800 bg-gray-900/60 p-5 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-white font-bold text-base">Property Details</h2>
            <p className="text-gray-500 text-xs mt-0.5">Enter values to explain</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* County */}
            <Field label="County">
              <div className="flex gap-1.5 flex-wrap">
                {COUNTIES.map(({ id, label, fips }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleChange('county', id)}
                    className={`flex-1 min-w-fit text-center text-xs px-2 py-1.5 rounded-lg border transition-all ${
                      input.county === id
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-medium'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    <span className="block leading-tight">{label}</span>
                    <span className="block text-[9px] opacity-60">{fips}</span>
                  </button>
                ))}
              </div>
            </Field>

            {/* Year Built */}
            <Field label={`Year Built — ${input.yearBuilt}`}>
              <input
                type="range"
                min={1900}
                max={2015}
                step={1}
                value={input.yearBuilt}
                onChange={(e) => handleChange('yearBuilt', +e.target.value)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                <span>1900</span><span>2015</span>
              </div>
            </Field>

            {/* Finished Sq Ft */}
            <Field label="Finished Sq Ft">
              <NumberInput
                value={input.finishedSqFt}
                onChange={(v) => handleChange('finishedSqFt', v)}
                min={400}
                max={10000}
                step={50}
              />
            </Field>

            {/* Lot Size Sq Ft */}
            <Field label="Lot Size Sq Ft">
              <NumberInput
                value={input.lotSizeSqFt}
                onChange={(v) => handleChange('lotSizeSqFt', v)}
                min={1000}
                max={100000}
                step={500}
              />
            </Field>

            {/* Tax Amount */}
            <Field label="Annual Tax Amount ($)">
              <NumberInput
                value={input.taxAmount}
                onChange={(v) => handleChange('taxAmount', v)}
                min={500}
                max={50000}
                step={100}
                prefix="$"
              />
            </Field>

            {/* Tax Value */}
            <Field label="Assessed Tax Value ($)">
              <NumberInput
                value={input.taxValue}
                onChange={(v) => handleChange('taxValue', v)}
                min={50000}
                max={5000000}
                step={5000}
                prefix="$"
              />
            </Field>

            {/* Transaction Month */}
            <Field label="Transaction Month">
              <select
                value={input.transactionMonth}
                onChange={(e) => handleChange('transactionMonth', +e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500/60"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>

            {/* Derived preview */}
            <div className="bg-gray-800/50 rounded-lg p-2.5 space-y-1 border border-gray-700/50">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5">Engineered features</p>
              <PreviewRow label="Property Age"     value={`${2016 - input.yearBuilt} yrs`} />
              <PreviewRow label="Tax Ratio"        value={`${((input.taxAmount / (input.taxValue + 1)) * 100).toFixed(3)}%`} />
              <PreviewRow label="Living Area Ratio" value={`${((input.finishedSqFt / (input.lotSizeSqFt + 1)) * 100).toFixed(1)}%`} />
            </div>

            {/* Buttons */}
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-sm transition-all"
            >
              Explain Prediction
            </button>

            <button
              type="button"
              onClick={handleSurprise}
              className="w-full py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
            >
              Surprise me
            </button>
          </form>

          {/* Info footer */}
          <div className="mt-6 border-t border-gray-800 pt-4 space-y-1">
            <p className="text-gray-600 text-[10px] leading-relaxed">
              Feature engineering mirrors model.py pipeline: tax ratios, area
              ratios, KMeans geo-clusters, cyclical month encoding, target
              encoding for county and cluster.
            </p>
            <p className="text-gray-600 text-[10px]">
              SHAP base value E[f(x)] = 0.01155 (training mean logerror)
            </p>
          </div>
        </aside>

        {/* ── Results panel ─────────────────────────────────────────────────── */}
        <main className="flex-1 p-5 overflow-y-auto min-w-0">
          {!result ? (
            <EmptyState onSurprise={handleSurprise} />
          ) : (
            <div className="max-w-4xl mx-auto space-y-5">

              {/* Prediction card */}
              <PredictionCard result={result} />

              {/* Chart tabs */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                {/* Tab bar */}
                <div className="flex border-b border-gray-800">
                  <TabButton
                    active={activeTab === 'waterfall'}
                    onClick={() => setActiveTab('waterfall')}
                    label="Waterfall"
                    subtitle="contribution by feature"
                  />
                  <TabButton
                    active={activeTab === 'importance'}
                    onClick={() => setActiveTab('importance')}
                    label="Importance"
                    subtitle="ranked |SHAP| values"
                  />
                </div>

                {/* Chart body */}
                <div className="p-5">
                  {activeTab === 'waterfall' ? (
                    <>
                      <SectionTitle
                        title="SHAP Waterfall"
                        description="Each bar shows how that feature pushes the prediction away from the base value. Red = increases logerror (overestimation), blue = decreases it."
                      />
                      <WaterfallChart
                        baseValue={result.baseValue}
                        prediction={result.prediction}
                        features={result.features}
                      />
                    </>
                  ) : (
                    <>
                      <SectionTitle
                        title="Feature Importance"
                        description="Absolute SHAP values ranked highest to lowest. The longer the bar, the more that feature influenced this specific prediction."
                      />
                      <ShapBarChart features={result.features} />
                    </>
                  )}
                </div>
              </div>

              {/* Feature detail table */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 pt-4 pb-2">
                  <SectionTitle
                    title="Feature Breakdown"
                    description="All engineered features, their computed values, and SHAP contributions for this property."
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-5 py-2 text-left text-gray-500 font-medium">Feature</th>
                        <th className="px-4 py-2 text-right text-gray-500 font-medium">Value</th>
                        <th className="px-4 py-2 text-right text-gray-500 font-medium">SHAP</th>
                        <th className="px-5 py-2 text-left text-gray-500 font-medium hidden md:table-cell">Interpretation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.features.map((f, i) => (
                        <tr
                          key={f.feature}
                          className={`border-b border-gray-800/50 ${i % 2 === 0 ? 'bg-gray-800/20' : ''}`}
                        >
                          <td className="px-5 py-2.5 text-gray-300 font-medium">{f.label}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-400">{f.rawValue}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                            f.shapValue > 0 ? 'text-red-400' : f.shapValue < 0 ? 'text-blue-400' : 'text-gray-500'
                          }`}>
                            {f.shapValue >= 0 ? '+' : ''}{f.shapValue.toFixed(5)}
                          </td>
                          <td className="px-5 py-2.5 text-gray-500 hidden md:table-cell max-w-xs">
                            <span className="line-clamp-2">{f.description}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700 bg-gray-800/40">
                        <td className="px-5 py-2.5 text-gray-400 font-semibold" colSpan={2}>
                          Base value + SHAP sum = Prediction
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                          result.prediction > 0 ? 'text-red-400' : 'text-blue-400'
                        }`}>
                          {result.prediction >= 0 ? '+' : ''}{result.prediction.toFixed(5)}
                        </td>
                        <td className="hidden md:table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <p className="text-gray-600 text-xs">
          Stacked ensemble: XGBoost + LightGBM + CatBoost · Ridge meta-model · SHAP via TreeExplainer
        </p>
        <p className="text-gray-700 text-xs">
          logerror = log(Zestimate) − log(SalePrice) · Southern California 2016
        </p>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-gray-400 text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className={`w-full bg-gray-800 border border-gray-700 rounded-lg py-2 text-sm text-gray-200
          focus:outline-none focus:border-amber-500/60 transition-colors
          ${prefix ? 'pl-7 pr-3' : 'px-3'}`}
      />
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-[10px]">{label}</span>
      <span className="text-gray-300 text-[10px] font-mono">{value}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-5 py-3 text-left transition-colors ${
        active
          ? 'bg-gray-800/60 border-b-2 border-amber-500'
          : 'hover:bg-gray-800/30 border-b-2 border-transparent'
      }`}
    >
      <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-500'}`}>{label}</p>
      <p className="text-gray-600 text-[10px]">{subtitle}</p>
    </button>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-gray-200 font-semibold text-sm">{title}</h3>
      <p className="text-gray-500 text-xs mt-0.5">{description}</p>
    </div>
  );
}

function EmptyState({ onSurprise }: { onSurprise: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
          <ShapIcon size={28} />
        </div>
        <div>
          <p className="text-gray-300 font-semibold text-lg">Ready to Explain</p>
          <p className="text-gray-500 text-sm mt-1">
            Fill in property details and click <span className="text-amber-400 font-medium">Explain Prediction</span>,
            or try a random Southern California property.
          </p>
        </div>
        <button
          onClick={onSurprise}
          className="px-5 py-2.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-sm hover:bg-indigo-500/20 transition-all"
        >
          Surprise me
        </button>
      </div>
    </div>
  );
}

function ShapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#f59e0b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
