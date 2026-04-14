'use client';

/**
 * app/risk-checker/page.tsx
 *
 * Zestimate Risk Checker — consumer-facing page.
 * Users enter property details and get a plain-English risk assessment driven
 * by the stacked ensemble model (XGBoost + LightGBM + CatBoost · Ridge meta).
 */

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { predictRisk, type PropertyInput, type RiskResult, type County } from '@/lib/riskPredictor';
import RiskBadge         from '@/components/RiskBadge';
import PredictionGauge   from '@/components/PredictionGauge';
import PriceRangeCard    from '@/components/PriceRangeCard';
import NeighbourhoodContext from '@/components/NeighbourhoodContext';

// ── Types ──────────────────────────────────────────────────────────────────────
type FormState = {
  zestimate:      string;
  yearBuilt:      string;
  finishedSqFt:   string;
  lotSizeSqFt:    string;
  taxAmount:      string;
  taxValue:       string;
  county:         County;
  transactionMonth: string;
};

const DEFAULTS: FormState = {
  zestimate:        '',
  yearBuilt:        '',
  finishedSqFt:     '',
  lotSizeSqFt:      '',
  taxAmount:        '',
  taxValue:         '',
  county:           'LA',
  transactionMonth: '6',
};

const MONTH_OPTIONS = [
  { v: '1',  l: 'January'   }, { v: '2',  l: 'February' },
  { v: '3',  l: 'March'     }, { v: '4',  l: 'April'    },
  { v: '5',  l: 'May'       }, { v: '6',  l: 'June'     },
  { v: '7',  l: 'July'      }, { v: '8',  l: 'August'   },
  { v: '9',  l: 'September' }, { v: '10', l: 'October'  },
  { v: '11', l: 'November'  }, { v: '12', l: 'December' },
];

const COUNTY_OPTIONS: { v: County; l: string }[] = [
  { v: 'LA',      l: 'Los Angeles County'  },
  { v: 'Orange',  l: 'Orange County'       },
  { v: 'Ventura', l: 'Ventura County'      },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function RiskCheckerPage() {
  const [form, setForm]         = useState<FormState>(DEFAULTS);
  const [result, setResult]     = useState<RiskResult | null>(null);
  const [errors, setErrors]     = useState<Partial<FormState>>({});
  const [adviceTab, setAdviceTab] = useState<'buyer' | 'seller'>('buyer');

  // ── Validation + submission ────────────────────────────────────────────────
  function validate(f: FormState): boolean {
    const e: Partial<FormState> = {};
    if (!f.zestimate     || +f.zestimate     <= 0) e.zestimate     = 'Enter a valid Zestimate value';
    if (!f.yearBuilt     || +f.yearBuilt     < 1800 || +f.yearBuilt > 2016) e.yearBuilt = 'Year must be 1800–2016';
    if (!f.finishedSqFt  || +f.finishedSqFt  <= 0) e.finishedSqFt  = 'Enter finished square footage';
    if (!f.lotSizeSqFt   || +f.lotSizeSqFt   <= 0) e.lotSizeSqFt   = 'Enter lot size';
    if (!f.taxAmount     || +f.taxAmount     <= 0) e.taxAmount     = 'Enter annual tax amount';
    if (!f.taxValue      || +f.taxValue      <= 0) e.taxValue      = 'Enter assessed tax value';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(form)) return;

    const input: PropertyInput = {
      zestimate:        +form.zestimate,
      yearBuilt:        +form.yearBuilt,
      finishedSqFt:     +form.finishedSqFt,
      lotSizeSqFt:      +form.lotSizeSqFt,
      taxAmount:        +form.taxAmount,
      taxValue:         +form.taxValue,
      county:           form.county,
      transactionMonth: +form.transactionMonth,
    };

    setResult(predictRisk(input));
    // Scroll to results smoothly
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  function handleReset() {
    setForm(DEFAULTS);
    setResult(null);
    setErrors({});
  }

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((er) => ({ ...er, [key]: undefined }));
    };
  }

  // ── Buyer / Seller advice copy ─────────────────────────────────────────────
  function getAdvice(r: RiskResult) {
    const pct = Math.abs(r.percentageDeviation).toFixed(1);
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

    if (r.riskLabel === 'OVERPRICED') {
      return {
        buyer: [
          `The Zestimate appears to be around ${pct}% above what similar homes have actually sold for. This gives you negotiating room.`,
          `Consider making an initial offer closer to ${fmt(r.truePriceMid)} rather than the listed Zestimate.`,
          `Request a formal independent appraisal before finalising any offer — it may confirm the lower value.',`,
          `If the seller won't move below the Zestimate, factor the potential overpayment into your long-term plans.`,
        ],
        seller: [
          `The Zestimate may be setting buyer expectations too high, which can deter serious offers.`,
          `A realistic listing price closer to ${fmt(r.truePriceMid)} could attract more qualified buyers and reduce time on market.`,
          `Highlight recent upgrades or unique features that justify a price above the model's estimate.`,
          `Be prepared for buyers to negotiate down; having your own comparable sales data will strengthen your position.`,
        ],
      };
    }

    if (r.riskLabel === 'UNDERPRICED') {
      return {
        buyer: [
          `The Zestimate looks conservative — the true market value may be around ${pct}% higher.`,
          `If you're seeing this price as a deal, act quickly; other buyers with similar analysis tools may do the same.`,
          `Verify with local comparable sales to confirm the opportunity before committing.`,
          `Factor in that the true price (${fmt(r.truePriceMid)}) may be more reflective of what you'll actually pay at auction.`,
        ],
        seller: [
          `Great news — the Zestimate may be undervaluing your home by approximately ${pct}%.`,
          `You could reasonably list closer to ${fmt(r.truePriceMid)} and still attract strong interest.`,
          `An independent appraisal can give you documented evidence to support a higher asking price.`,
          `Avoid pricing too far above the model estimate without supporting evidence, as this risks the home sitting unsold.`,
        ],
      };
    }

    // FAIR
    return {
      buyer: [
        `The Zestimate is within normal accuracy range — the listed price is likely a fair reflection of market value.`,
        `Focus your negotiation on condition-specific factors (age of HVAC, roof, kitchen) rather than the headline price.`,
        `The estimated true price of ${fmt(r.truePriceMid)} is close to the Zestimate, suggesting limited room for a big discount.`,
        `This is a well-priced property — strong offers near asking are more likely to succeed.`,
      ],
      seller: [
        `The Zestimate accurately reflects market value — you're well positioned to list at or near it.`,
        `Buyers viewing this property are unlikely to find algorithmic evidence to justify a significantly lower offer.`,
        `Minor pricing adjustments (±2–3%) are unlikely to materially change days-on-market in this range.`,
        `Focus on presentation and marketing to maximise speed of sale at the fair-market price.`,
      ],
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <ShieldIcon />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              Zestimate Risk Checker
            </h1>
            <p className="text-gray-500 text-xs">
              Powered by stacked ensemble · XGBoost + LightGBM + CatBoost · CV RMSE 0.0742
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-lg px-3 py-1.5 transition-all"
          >
            <MapIcon />
            Heatmap
          </Link>
          <Link
            href="/explainer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-all"
          >
            SHAP Explainer
          </Link>
          <Link
            href="/monitoring"
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-all"
          >
            Monitoring
          </Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-3 pt-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Is this Zestimate <span className="text-indigo-400">accurate</span>?
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Enter your property details and we'll tell you whether Zillow's estimate
            is likely too high, too low, or spot-on — in plain English.
          </p>
        </div>

        {/* ── Input Form ──────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <h3 className="text-white font-bold text-lg">Property Details</h3>

          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Zillow Zestimate"
              hint="The estimated value shown on Zillow"
              prefix="$"
              type="number"
              placeholder="e.g. 650000"
              value={form.zestimate}
              onChange={set('zestimate')}
              error={errors.zestimate}
            />
            <Field
              label="Year Built"
              hint="Year the home was originally constructed"
              type="number"
              placeholder="e.g. 1985"
              value={form.yearBuilt}
              onChange={set('yearBuilt')}
              error={errors.yearBuilt}
            />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Finished Living Area"
              hint="Interior finished square footage"
              suffix="sq ft"
              type="number"
              placeholder="e.g. 1800"
              value={form.finishedSqFt}
              onChange={set('finishedSqFt')}
              error={errors.finishedSqFt}
            />
            <Field
              label="Lot Size"
              hint="Total lot / land area"
              suffix="sq ft"
              type="number"
              placeholder="e.g. 6000"
              value={form.lotSizeSqFt}
              onChange={set('lotSizeSqFt')}
              error={errors.lotSizeSqFt}
            />
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Annual Property Tax"
              hint="Most recent annual tax bill"
              prefix="$"
              type="number"
              placeholder="e.g. 7200"
              value={form.taxAmount}
              onChange={set('taxAmount')}
              error={errors.taxAmount}
            />
            <Field
              label="Assessed Tax Value"
              hint="County's assessed value for tax purposes"
              prefix="$"
              type="number"
              placeholder="e.g. 580000"
              value={form.taxValue}
              onChange={set('taxValue')}
              error={errors.taxValue}
            />
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* County */}
            <div className="space-y-1.5">
              <label className="text-gray-300 text-sm font-medium">County</label>
              <p className="text-gray-600 text-xs">Southern California county where the property sits</p>
              <select
                value={form.county}
                onChange={set('county')}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {COUNTY_OPTIONS.map((c) => (
                  <option key={c.v} value={c.v}>{c.l}</option>
                ))}
              </select>
            </div>

            {/* Transaction Month */}
            <div className="space-y-1.5">
              <label className="text-gray-300 text-sm font-medium">Expected Sale Month</label>
              <p className="text-gray-600 text-xs">Month you expect to buy or sell</p>
              <select
                value={form.transactionMonth}
                onChange={set('transactionMonth')}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.v} value={m.v}>{m.l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/40"
            >
              Analyse Zestimate
            </button>
            {result && (
              <button
                type="button"
                onClick={handleReset}
                className="sm:w-auto px-6 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 text-sm transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {result && (
          <div id="results" className="space-y-6 scroll-mt-6">

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-600 text-xs uppercase tracking-widest">Your results</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* Top row: badge + gauge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <RiskBadge
                label={result.riskLabel}
                percentageDeviation={result.percentageDeviation}
              />
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">
                  Predicted logerror
                </p>
                <PredictionGauge logerror={result.logerror} />
              </div>
            </div>

            {/* Summary sentence */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                {getSummaryText(result)}
              </p>
            </div>

            {/* Price range */}
            <PriceRangeCard
              zestimate={+form.zestimate}
              truePriceLow={result.truePriceLow}
              truePriceMid={result.truePriceMid}
              truePriceHigh={result.truePriceHigh}
              riskLabel={result.riskLabel}
            />

            {/* SHAP reasons */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-bold text-base">
                Why does this estimate look {result.riskLabel === 'FAIR' ? 'accurate' : result.riskLabel.toLowerCase()}?
              </h3>
              <div className="space-y-3">
                {result.shapReasons.map((r, i) => (
                  <ShapRow key={r.feature} rank={i + 1} reason={r} />
                ))}
              </div>
              <p className="text-gray-600 text-[11px]">
                Factors derived from model feature importance (XGBoost TreeExplainer SHAP).
                Relative magnitudes reflect the trained ensemble on Southern California 2016 data.
              </p>
            </div>

            {/* Neighbourhood context */}
            <NeighbourhoodContext
              logerror={result.logerror}
              countyAvgLogerror={result.countyAvgLogerror}
              countyName={result.countyName}
              clusterDescription={result.clusterDescription}
            />

            {/* Buyer / Seller advice toggle */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Toggle tabs */}
              <div className="flex border-b border-gray-800">
                {(['buyer', 'seller'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAdviceTab(tab)}
                    className={`flex-1 py-3 text-sm font-semibold transition-all capitalize ${
                      adviceTab === tab
                        ? 'bg-gray-800 text-white border-b-2 border-indigo-500'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab === 'buyer' ? 'I\'m a Buyer' : 'I\'m a Seller'}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-3">
                <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">
                  What does this mean for me?
                </p>
                {getAdvice(result)[adviceTab].map((tip, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-gray-300 text-sm leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-gray-700 text-[11px] leading-relaxed text-center pb-4">
              This tool is for informational purposes only and does not constitute financial or legal advice.
              Predictions are based on a mock calibration of the trained ensemble model and Southern California 2016 market data.
              Always consult a licensed real estate professional before making decisions.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Helper: summary sentence ──────────────────────────────────────────────────
function getSummaryText(r: RiskResult): string {
  const pct    = Math.abs(r.percentageDeviation).toFixed(1);
  const fmt    = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  if (r.riskLabel === 'OVERPRICED') {
    return `Based on comparable ${r.clusterDescription} properties, Zillow's estimate is likely around ${pct}% higher than the actual sale price. Our model suggests a more realistic value is around ${fmt(r.truePriceMid)}.`;
  }
  if (r.riskLabel === 'UNDERPRICED') {
    return `Based on comparable ${r.clusterDescription} properties, Zillow's estimate appears to be around ${pct}% lower than what this home might actually sell for. A more realistic estimate is around ${fmt(r.truePriceMid)}.`;
  }
  return `The Zestimate looks reasonable for a ${r.clusterDescription} property. Our model estimates the true sale price is very close to the Zestimate — within ±${pct}%.`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, hint, prefix, suffix, type, placeholder, value, onChange, error,
}: {
  label: string; hint?: string; prefix?: string; suffix?: string;
  type: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-gray-300 text-sm font-medium">{label}</label>
      {hint && <p className="text-gray-600 text-xs">{hint}</p>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-500 text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          min={0}
          className={`w-full bg-gray-800 border rounded-xl py-2.5 text-white text-sm placeholder-gray-600
            focus:outline-none focus:border-indigo-500 transition-colors
            ${prefix ? 'pl-7 pr-4' : suffix ? 'pl-4 pr-14' : 'px-4'}
            ${error ? 'border-red-500/70' : 'border-gray-700'}`}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-500 text-xs pointer-events-none">{suffix}</span>
        )}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

function ShapRow({
  rank, reason,
}: {
  rank: number;
  reason: { displayName: string; value: string; impact: number; sentence: string };
}) {
  const abs     = Math.abs(reason.impact);
  const barPct  = Math.min(100, (abs / 0.08) * 100);
  const positive = reason.impact > 0;
  const barColor = positive ? '#ef4444' : '#3b82f6';
  const sign     = positive ? '↑' : '↓';

  return (
    <div className="flex gap-3 items-start">
      <span className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-gray-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {rank}
      </span>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-300 text-sm font-medium">{reason.displayName}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs font-mono">{reason.value}</span>
            <span className="text-[10px] font-bold" style={{ color: barColor }}>{sign}</span>
          </div>
        </div>
        {/* Impact bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barPct}%`, background: barColor, opacity: 0.75 }}
          />
        </div>
        <p className="text-gray-500 text-xs leading-relaxed">{reason.sentence}</p>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}
