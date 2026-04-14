'use client';

/**
 * PredictionCard.tsx
 *
 * Displays the final predicted logerror value with:
 *  - Direction indicator (overestimated / underestimated / accurate)
 *  - Approximate percentage impact on the Zestimate
 *  - 90% confidence band
 *  - Top 3 driving features
 */

import type { ShapResult } from '@/lib/shapMock';

interface PredictionCardProps {
  result: ShapResult;
}

function interpret(logerror: number): {
  headline: string;
  subline: string;
  badge: string;
  badgeClass: string;
  borderClass: string;
  pct: number;
} {
  // logerror = log(Zestimate) - log(SalePrice)
  // → Zestimate / SalePrice ≈ e^logerror ≈ 1 + logerror (for small values)
  const pct = (Math.exp(logerror) - 1) * 100;

  if (logerror > 0.03) {
    return {
      headline: `Zestimate likely overestimated by ~${pct.toFixed(1)}%`,
      subline:  'The model predicts the automated valuation is higher than the eventual sale price.',
      badge:    'Overestimated',
      badgeClass: 'bg-red-500/15 border-red-500/40 text-red-400',
      borderClass: 'border-red-500/30',
      pct,
    };
  } else if (logerror < -0.03) {
    return {
      headline: `Zestimate likely underestimated by ~${Math.abs(pct).toFixed(1)}%`,
      subline:  'The model predicts the automated valuation is lower than the eventual sale price.',
      badge:    'Underestimated',
      badgeClass: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
      borderClass: 'border-blue-500/30',
      pct,
    };
  } else {
    return {
      headline: `Zestimate is approximately accurate (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`,
      subline:  'The predicted logerror is near zero — the Zestimate closely tracks expected sale price.',
      badge:    'Accurate',
      badgeClass: 'bg-green-500/15 border-green-500/40 text-green-400',
      borderClass: 'border-green-500/30',
      pct,
    };
  }
}

export default function PredictionCard({ result }: PredictionCardProps) {
  const { prediction, baseValue, confidenceLow, confidenceHigh, features } = result;
  const info = interpret(prediction);
  const topDrivers = features.slice(0, 3);

  return (
    <div className={`rounded-xl border ${info.borderClass} bg-gray-900/60 p-5 space-y-4`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-1">
            Predicted logerror
          </p>
          <p className="text-white text-3xl font-mono font-bold leading-tight">
            {prediction >= 0 ? '+' : ''}{prediction.toFixed(5)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${info.badgeClass} flex-shrink-0`}>
          {info.badge}
        </span>
      </div>

      {/* ── Interpretation ─────────────────────────────────────────────────── */}
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
        <p className="text-gray-200 text-sm font-medium">{info.headline}</p>
        <p className="text-gray-500 text-xs leading-relaxed">{info.subline}</p>
      </div>

      {/* ── Confidence band ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">
          90% Confidence Interval
        </p>
        <div className="relative h-6 bg-gray-800 rounded-full overflow-hidden">
          {/* Band fill */}
          {(() => {
            const totalRange = 0.30;  // display range: -0.15 … +0.15
            const toPercent  = (v: number) => ((v + 0.15) / totalRange) * 100;

            const lo    = toPercent(confidenceLow);
            const hi    = toPercent(confidenceHigh);
            const pred  = toPercent(prediction);
            const zero  = toPercent(0);

            return (
              <>
                {/* Confidence band */}
                <div
                  className="absolute top-0 h-full bg-amber-500/20"
                  style={{ left: `${Math.max(0, lo)}%`, width: `${Math.min(100, hi) - Math.max(0, lo)}%` }}
                />
                {/* Zero line */}
                <div
                  className="absolute top-0 h-full w-px bg-gray-600"
                  style={{ left: `${zero}%` }}
                />
                {/* Prediction marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-amber-400"
                  style={{ left: `${Math.min(99.5, Math.max(0.5, pred))}%` }}
                />
              </>
            );
          })()}
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5 font-mono">
          <span>−0.15</span>
          <span className="text-gray-500">
            [{confidenceLow >= 0 ? '+' : ''}{confidenceLow.toFixed(3)},&nbsp;
             {confidenceHigh >= 0 ? '+' : ''}{confidenceHigh.toFixed(3)}]
          </span>
          <span>+0.15</span>
        </div>
      </div>

      {/* ── Key stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox
          label="Base value E[f(x)]"
          value={(baseValue >= 0 ? '+' : '') + baseValue.toFixed(5)}
          note="Training mean logerror"
        />
        <StatBox
          label="SHAP sum"
          value={((prediction - baseValue) >= 0 ? '+' : '') + (prediction - baseValue).toFixed(5)}
          note="Total feature contribution"
          highlight={prediction - baseValue}
        />
      </div>

      {/* ── Top 3 drivers ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">
          Top driving features
        </p>
        <ul className="space-y-2">
          {topDrivers.map((f) => (
            <li key={f.feature} className="flex items-start gap-2">
              <span
                className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: f.shapValue >= 0 ? '#ef4444' : '#3b82f6', marginTop: '5px' }}
              />
              <p className="text-gray-400 text-[11px] leading-relaxed">{f.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note: string;
  highlight?: number;
}) {
  const valueClass =
    highlight === undefined
      ? 'text-gray-200'
      : highlight > 0
      ? 'text-red-400'
      : highlight < 0
      ? 'text-blue-400'
      : 'text-gray-200';

  return (
    <div className="bg-gray-800/50 rounded-lg p-2.5">
      <p className="text-gray-500 text-[10px] mb-1">{label}</p>
      <p className={`font-mono font-bold text-sm ${valueClass}`}>{value}</p>
      <p className="text-gray-600 text-[9px] mt-0.5">{note}</p>
    </div>
  );
}
