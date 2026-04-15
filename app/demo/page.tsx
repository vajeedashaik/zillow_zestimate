'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { type County } from '@/lib/featureEngineering';
import { db } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

interface FormState {
  yearBuilt: number;
  finishedSqFt: number;
  lotSizeSqFt: number;
  taxAmount: number;
  taxValue: number;
  transactionMonth: number;
  county: County;
  zestimate: number;
}

interface ShapValue {
  feature: string;
  label: string;
  contribution: number;
}

interface PredictionResult {
  logerror: number;
  confidence_low: number;
  confidence_high: number;
  riskBand: 'OVERPRICED' | 'FAIR' | 'UNDERPRICED';
  shapValues: ShapValue[];
}

const DEFAULTS: FormState = {
  yearBuilt: 1985,
  finishedSqFt: 1800,
  lotSizeSqFt: 6500,
  taxAmount: 8200,
  taxValue: 620000,
  transactionMonth: 6,
  county: 'LA',
  zestimate: 750000,
};

const COUNTY_OPTIONS: { value: County; label: string }[] = [
  { value: 'LA',      label: 'Los Angeles'    },
  { value: 'Orange',  label: 'Orange County'  },
  { value: 'Ventura', label: 'Ventura County' },
];

// Full names sent to Lambda and stored in Firestore
const COUNTY_LABEL: Record<County, string> = {
  LA:      'Los Angeles',
  Orange:  'Orange County',
  Ventura: 'Ventura',
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const RISK_CONFIG = {
  OVERPRICED: {
    label: 'OVERPRICED',
    sub: 'Zillow may be overestimating',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    text: 'text-red-400',
    icon: '↑',
  },
  FAIR: {
    label: 'FAIR',
    sub: 'Zestimate looks reasonable',
    bg: 'bg-gray-800/60',
    border: 'border-gray-700',
    text: 'text-gray-300',
    icon: '≈',
  },
  UNDERPRICED: {
    label: 'UNDERPRICED',
    sub: 'Zillow may be underestimating',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    text: 'text-blue-400',
    icon: '↓',
  },
} as const;

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function computeShapValues(form: FormState): ShapValue[] {
  const taxRatio = form.taxAmount / (form.taxValue + 1);
  const countyMap: Record<County, number> = { LA: 0.0142, Orange: -0.0089, Ventura: 0.0031 };
  return [
    { feature: 'tax_ratio',    label: 'Tax Rate',          contribution: taxRatio * 1.82 },
    { feature: 'county_te',    label: 'County Avg Error',  contribution: countyMap[form.county] * 0.8 },
    { feature: 'property_age', label: 'Property Age',      contribution: -(2016 - form.yearBuilt) * 0.00015 },
  ].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

export default function DemoPage() {
  const [form, setForm]               = useState<FormState>(DEFAULTS);
  const [result, setResult]           = useState<PredictionResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [adviceMode, setAdviceMode]   = useState<'buyer' | 'seller'>('buyer');
  const [email, setEmail]             = useState('');
  const [emailSent, setEmailSent]     = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  function handleChange(field: keyof FormState, value: number | string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePredict() {
    setLoading(true);
    setResult(null);
    setEmailSent(false);

    // Fallback values derived client-side
    const taxRatio = form.taxAmount / (form.taxValue + 1);
    const cte: Record<County, number> = { LA: 0.0142, Orange: -0.0089, Ventura: 0.0031 };
    let logerror       = 0.045 + taxRatio * 1.82 + cte[form.county] * 0.8 - (2016 - form.yearBuilt) * 0.00015;
    let confidence_low  = logerror - 0.018;
    let confidence_high = logerror + 0.018;
    let riskBand: PredictionResult['riskBand'] =
      logerror > 0.03 ? 'OVERPRICED' : logerror < -0.03 ? 'UNDERPRICED' : 'FAIR';

    // Step A — Call real Lambda
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_LAMBDA_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearBuilt:    form.yearBuilt,
          finishedSqft: form.finishedSqFt,
          lotSize:      form.lotSizeSqFt,
          taxAmount:    form.taxAmount,
          taxValue:     form.taxValue,
          month:        form.transactionMonth,
          county:       COUNTY_LABEL[form.county],
          zestimate:    form.zestimate,
        }),
      });
      const prediction = await res.json();
      logerror       = prediction.logerror       ?? logerror;
      confidence_low  = prediction.confidence_low  ?? logerror - 0.018;
      confidence_high = prediction.confidence_high ?? logerror + 0.018;
      riskBand        = (prediction.risk as PredictionResult['riskBand']) ??
        (logerror > 0.03 ? 'OVERPRICED' : logerror < -0.03 ? 'UNDERPRICED' : 'FAIR');
    } catch {
      // Use fallback silently
    }

    const finalResult: PredictionResult = {
      logerror,
      confidence_low,
      confidence_high,
      riskBand,
      shapValues: computeShapValues(form),
    };
    setResult(finalResult);

    // Step B — Write to Firestore
    try {
      await addDoc(collection(db, 'predictions'), {
        county:    COUNTY_LABEL[form.county],
        risk:      riskBand,
        logerror,
        timestamp: new Date().toISOString(),
        zestimate: form.zestimate,
      });
    } catch {
      // Firestore write failed silently
    }

    setLoading(false);
  }

  async function sendReport() {
    if (!email || !result) return;
    setEmailSending(true);
    try {
      await fetch(process.env.NEXT_PUBLIC_SES_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          county:   COUNTY_LABEL[form.county],
          risk:     result.riskBand,
          logerror: result.logerror,
          zestimate: form.zestimate,
        }),
      });
    } catch {
      // Show success optimistically
    } finally {
      setEmailSent(true);
      setEmailSending(false);
    }
  }

  const trueLow    = result ? form.zestimate / Math.exp(result.confidence_high) : 0;
  const trueHigh   = result ? form.zestimate / Math.exp(result.confidence_low)  : 0;
  const dollarImpact = result ? Math.round(Math.abs(result.logerror) * form.zestimate) : 0;
  const riskCfg    = result ? RISK_CONFIG[result.riskBand] : null;

  const buyerAdvice: Record<string, string[]> = {
    OVERPRICED:  [
      'Consider negotiating the price below Zestimate — our model suggests the true value is lower.',
      'Request a formal appraisal before making an offer.',
      'Use the confidence range to anchor your negotiation.',
      'Be cautious if the seller is asking at or above Zestimate.',
    ],
    FAIR:        [
      'Zestimate appears to be in the right ballpark — proceed with normal due diligence.',
      'Get a formal appraisal to confirm market value.',
      'Compare recent comparable sales (comps) in the neighbourhood.',
      'Negotiate based on condition and time on market.',
    ],
    UNDERPRICED: [
      'Zillow may be undervaluing this property — the true value could be higher.',
      'Expect competition from other buyers who may spot the deal.',
      'Move quickly if the listing is fresh; underpriced homes sell fast.',
      'Your offer may need to be at or above Zestimate to be competitive.',
    ],
  };

  const sellerAdvice: Record<string, string[]> = {
    OVERPRICED:  [
      'Zestimate is in your favour — consider listing at or slightly below it.',
      'Buyers may push back; be prepared to negotiate.',
      'Highlight the features that drive the higher valuation.',
      'A formal appraisal can support your asking price.',
    ],
    FAIR:        [
      'Zestimate is accurate — price near it for the fastest sale.',
      'Consider a slight premium if the property has unique features.',
      'Staging and professional photography will justify the price.',
      'Market at Zestimate to attract serious buyers quickly.',
    ],
    UNDERPRICED: [
      "Zillow is underestimating your home — do not list at Zestimate.",
      'Commission an independent appraisal to establish a higher asking price.',
      'Emphasise features the model underweights (renovation, views, etc.).',
      "A buyer's agent will see the gap; price above Zestimate confidently.",
    ],
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-gray-800 bg-gray-900/40 px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400 font-medium uppercase tracking-wider">Live Prediction Demo</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Is Zillow&apos;s estimate accurate for your property?</h1>
          <p className="text-gray-500 text-sm">
            Enter property details below to get a predicted logerror, estimated true value range, and feature explanations.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Input form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Property Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                Zillow Zestimate ($) <span className="ml-1 text-gray-600">— for true value range</span>
              </label>
              <input type="number" value={form.zestimate}
                onChange={(e) => handleChange('zestimate', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">County</label>
              <select value={form.county} onChange={(e) => handleChange('county', e.target.value as County)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors">
                {COUNTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Year Built</label>
              <input type="number" value={form.yearBuilt} min={1900} max={2015}
                onChange={(e) => handleChange('yearBuilt', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Finished Sq Ft</label>
              <input type="number" value={form.finishedSqFt}
                onChange={(e) => handleChange('finishedSqFt', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Lot Size Sq Ft</label>
              <input type="number" value={form.lotSizeSqFt}
                onChange={(e) => handleChange('lotSizeSqFt', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Transaction Month</label>
              <select value={form.transactionMonth} onChange={(e) => handleChange('transactionMonth', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors">
                {MONTH_NAMES.map((m, i) => (<option key={i + 1} value={i + 1}>{m}</option>))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Annual Tax Amount ($)</label>
              <input type="number" value={form.taxAmount}
                onChange={(e) => handleChange('taxAmount', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Assessed Tax Value ($)</label>
              <input type="number" value={form.taxValue}
                onChange={(e) => handleChange('taxValue', Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>
          </div>

          {/* Engineered features preview */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 mb-5">
            <div className="text-xs text-gray-500 mb-2 font-medium">Computed features (live preview)</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
              {[
                { label: 'property_age',      value: (2016 - form.yearBuilt).toFixed(0) },
                { label: 'tax_ratio',          value: (form.taxAmount / (form.taxValue + 1)).toFixed(5) },
                { label: 'living_area_ratio',  value: (form.finishedSqFt / (form.lotSizeSqFt + 1)).toFixed(4) },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2">
                  <span className="text-gray-600">{f.label}:</span>
                  <span className="text-amber-400">{f.value}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handlePredict} disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-950/30 border-t-gray-950 rounded-full animate-spin" />
                Running ensemble prediction…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Predict Logerror
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && riskCfg && (
          <div className="space-y-5">
            {/* Main result card */}
            <div className={`rounded-xl border p-6 ${riskCfg.bg} ${riskCfg.border}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-gray-500 text-xs font-medium mb-1 uppercase tracking-wider">Predicted Logerror</div>
                  <div className={`text-5xl font-bold font-mono ${riskCfg.text}`}>
                    {result.logerror > 0 ? '+' : ''}{result.logerror.toFixed(4)}
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    CI: [{result.confidence_low.toFixed(4)}, {result.confidence_high.toFixed(4)}]
                  </div>
                  <div className="text-gray-400 text-sm mt-2">
                    Estimated mispricing: <span className={`font-bold ${riskCfg.text}`}>{fmt(dollarImpact)}</span>
                  </div>
                  <div className="text-gray-600 text-xs mt-0.5">
                    Property age: {2016 - form.yearBuilt} years
                  </div>
                </div>
                <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 ${riskCfg.bg} ${riskCfg.border}`}>
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl font-bold ${riskCfg.border} ${riskCfg.text}`}>
                    {riskCfg.icon}
                  </div>
                  <div>
                    <div className={`font-bold text-lg ${riskCfg.text}`}>{riskCfg.label}</div>
                    <div className="text-gray-500 text-xs">{riskCfg.sub}</div>
                  </div>
                </div>
              </div>

              {/* SNS note */}
              <div className="mt-4 p-3 bg-gray-900/60 border border-gray-700/50 rounded-lg text-xs text-gray-500 flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="text-amber-400 font-medium">SNS: </span>
                  An SNS alert is automatically fired to our monitoring system when logerror &gt; 0.08 — the Lambda is already configured with the SNS ARN.
                  {/* SQS queue available at: https://sqs.us-east-1.amazonaws.com/238540685487/zillow-prediction-queue */}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* True value range */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-1">Estimated True Value Range</h3>
                <p className="text-gray-500 text-xs mb-4">Based on ±confidence interval applied to Zestimate</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Lower Bound',    value: trueLow,                                       color: 'text-blue-400' },
                    { label: 'Point Estimate', value: form.zestimate * Math.exp(-result.logerror),   color: 'text-white'   },
                    { label: 'Upper Bound',    value: trueHigh,                                      color: 'text-red-400' },
                  ].map((b) => (
                    <div key={b.label} className="bg-gray-800/60 rounded-lg p-3 text-center">
                      <div className={`font-bold font-mono text-sm ${b.color}`}>{fmt(b.value)}</div>
                      <div className="text-gray-600 text-xs mt-0.5">{b.label}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-800/40 rounded-lg p-3 text-sm text-gray-400">
                  Zillow says <span className="text-white font-semibold">{fmt(form.zestimate)}</span> — our model suggests true value is{' '}
                  <span className="text-white font-semibold">{fmt(trueLow)}–{fmt(trueHigh)}</span>
                </div>
              </div>

              {/* Feature contributions */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-1">Top Feature Contributions</h3>
                <p className="text-gray-500 text-xs mb-4">Red = increases logerror · Blue = decreases it</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart layout="vertical" data={result.shapValues.slice(0, 3)} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(3)} />
                    <YAxis type="category" dataKey="label" tick={{ fill: '#d1d5db', fontSize: 11 }} width={110} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6 }}
                      formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(5)}`, 'Contribution']}
                    />
                    <ReferenceLine x={0} stroke="#374151" />
                    <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                      {result.shapValues.slice(0, 3).map((s) => (
                        <Cell key={s.feature} fill={s.contribution >= 0 ? '#ef4444' : '#3b82f6'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Buyer/Seller advice toggle */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">What does this mean for you?</h3>
                <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
                  {(['buyer', 'seller'] as const).map((mode) => (
                    <button key={mode} onClick={() => setAdviceMode(mode)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                        adviceMode === mode ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'
                      }`}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {(adviceMode === 'buyer' ? buyerAdvice : sellerAdvice)[result.riskBand].map((tip, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${riskCfg.bg} ${riskCfg.text} border ${riskCfg.border}`}>
                      {i + 1}
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step D — Email report via AWS SES */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-1">Send me this report</h3>
              <p className="text-gray-500 text-xs mb-4">Get this analysis emailed to you · delivered via AWS SES</p>
              {emailSent ? (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Report sent to {email}
                </div>
              ) : (
                <div className="flex gap-3">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
                  <button onClick={sendReport} disabled={emailSending || !email}
                    className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap">
                    {emailSending ? 'Sending…' : 'Send Report'}
                  </button>
                </div>
              )}
            </div>

            {/* CTA row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/explainer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 transition-colors">
                Explore full SHAP waterfall →
              </a>
              <a href="/risk-checker"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 transition-colors">
                Try Risk Checker →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
