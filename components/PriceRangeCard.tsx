'use client';

/**
 * components/PriceRangeCard.tsx
 *
 * Shows the Zestimate, estimated true price mid, and a ±90% confidence band
 * derived from the model RMSE (0.0742).  Includes a simple bar visualisation.
 */

interface PriceRangeCardProps {
  zestimate:     number;
  truePriceLow:  number;
  truePriceMid:  number;
  truePriceHigh: number;
  riskLabel:     'OVERPRICED' | 'FAIR' | 'UNDERPRICED';
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

export default function PriceRangeCard({
  zestimate,
  truePriceLow,
  truePriceMid,
  truePriceHigh,
  riskLabel,
}: PriceRangeCardProps) {
  // Bar visualisation: position zestimate and mid within the range
  const span   = truePriceHigh - truePriceLow;
  const zPct   = span > 0 ? ((zestimate    - truePriceLow) / span) * 100 : 50;
  const midPct = span > 0 ? ((truePriceMid - truePriceLow) / span) * 100 : 50;

  const midColor =
    riskLabel === 'OVERPRICED'   ? '#ef4444' :
    riskLabel === 'UNDERPRICED'  ? '#3b82f6' : '#10b981';

  const midLabel =
    riskLabel === 'OVERPRICED'
      ? 'Likely lower'
      : riskLabel === 'UNDERPRICED'
      ? 'Likely higher'
      : 'Likely price';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
      <h3 className="text-white font-bold text-base">Estimated Price Range</h3>

      {/* Three price boxes */}
      <div className="grid grid-cols-3 gap-3">
        <PriceBox label="90% CI Low"   value={fmt(truePriceLow)}  sub="conservative floor" color="text-blue-400" />
        <PriceBox label={midLabel}     value={fmt(truePriceMid)}  sub="model estimate"     color="text-white"   highlight />
        <PriceBox label="90% CI High"  value={fmt(truePriceHigh)} sub="optimistic ceiling" color="text-red-400" />
      </div>

      {/* Visual bar */}
      <div className="space-y-1.5">
        <div className="relative h-4 bg-gray-800 rounded-full overflow-visible">
          {/* Gradient fill for the confidence band */}
          <div
            className="absolute inset-y-0 left-0 right-0 rounded-full opacity-30"
            style={{
              background: 'linear-gradient(to right, #3b82f6, #10b981, #ef4444)',
            }}
          />

          {/* Zestimate marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
            style={{ left: `${Math.max(2, Math.min(98, zPct))}%` }}
            title={`Zestimate: ${fmt(zestimate)}`}
          >
            <div className="w-3 h-6 rounded-sm bg-amber-400 border border-amber-500 shadow-lg" />
          </div>

          {/* True price mid marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
            style={{ left: `${Math.max(2, Math.min(98, midPct))}%` }}
            title={`Estimated true price: ${fmt(truePriceMid)}`}
          >
            <div
              className="w-3 h-6 rounded-sm border shadow-lg"
              style={{ background: midColor, borderColor: midColor }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-between items-center text-[10px] text-gray-500">
          <span>{fmt(truePriceLow)}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-3 rounded-sm bg-amber-400 inline-block" /> Zestimate
            </span>
            <span className="flex items-center gap-1">
              <span
                className="w-2.5 h-3 rounded-sm inline-block"
                style={{ background: midColor }}
              />
              True estimate
            </span>
          </div>
          <span>{fmt(truePriceHigh)}</span>
        </div>
      </div>

      {/* Zestimate row */}
      <div className="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-700/50">
        <span className="text-gray-400 text-sm">Zillow Zestimate</span>
        <span className="text-amber-400 font-bold font-mono text-sm">{fmt(zestimate)}</span>
      </div>

      <p className="text-gray-600 text-[11px] leading-relaxed">
        Range based on ensemble CV RMSE of 0.0742 · 90% confidence interval (±1.645σ).
        Actual sale prices may fall outside this range due to condition, renovations, or market shifts.
      </p>
    </div>
  );
}

function PriceBox({
  label, value, sub, color, highlight = false,
}: {
  label: string; value: string; sub: string;
  color: string; highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 text-center border space-y-0.5 ${
        highlight
          ? 'bg-gray-800 border-gray-600'
          : 'bg-gray-800/40 border-gray-800'
      }`}
    >
      <p className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</p>
      <p className={`font-bold text-sm font-mono ${color}`}>{value}</p>
      <p className="text-gray-600 text-[9px]">{sub}</p>
    </div>
  );
}
