'use client';

/**
 * components/NeighbourhoodContext.tsx
 *
 * Shows how this property's predicted logerror sits relative to the county
 * average.  Renders a mini horizontal bar chart.
 */

interface NeighbourhoodContextProps {
  logerror:          number;
  countyAvgLogerror: number;
  countyName:        string;
  clusterDescription: string;
}

const fmt2 = (v: number) => (v >= 0 ? `+${v.toFixed(4)}` : v.toFixed(4));

/** Map logerror to bar width % within [-0.15, +0.15] display window */
function toBarPct(v: number) {
  const clamped = Math.max(-0.15, Math.min(0.15, v));
  return ((clamped + 0.15) / 0.30) * 100;
}

function barColor(v: number) {
  if (v >  0.025) return '#ef4444';
  if (v < -0.025) return '#3b82f6';
  return '#10b981';
}

export default function NeighbourhoodContext({
  logerror,
  countyAvgLogerror,
  countyName,
  clusterDescription,
}: NeighbourhoodContextProps) {
  const diff = logerror - countyAvgLogerror;
  const absDiff = Math.abs(diff);

  const comparisonText =
    absDiff < 0.005
      ? `This property's estimate accuracy is in line with the typical ${countyName} home.`
      : diff > 0
      ? `This Zestimate is ${(absDiff * 100).toFixed(1)}% more optimistic than the average for ${countyName} — the Zestimate may be further above true value than usual for this area.`
      : `This Zestimate is ${(absDiff * 100).toFixed(1)}% more conservative than the ${countyName} average — there may be more upside than is typical for this area.`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold text-base">Neighbourhood Context</h3>
          <p className="text-gray-500 text-xs mt-0.5 capitalize">{clusterDescription}</p>
        </div>
        <span className="text-[10px] text-gray-600 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 whitespace-nowrap">
          {countyName}
        </span>
      </div>

      {/* Comparison bars */}
      <div className="space-y-3">
        <BarRow
          label="This property"
          value={logerror}
          barPct={toBarPct(logerror)}
          color={barColor(logerror)}
          bold
        />
        <BarRow
          label={`${countyName} avg`}
          value={countyAvgLogerror}
          barPct={toBarPct(countyAvgLogerror)}
          color="#6b7280"
        />
      </div>

      {/* Zero line labels */}
      <div className="relative">
        <div className="relative h-px bg-gray-800">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-gray-600"
            style={{ left: '50%' }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-1">
          <span>Under-priced ←</span>
          <span>0</span>
          <span>→ Over-priced</span>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-gray-400 text-sm leading-relaxed border-l-2 border-gray-700 pl-3">
        {comparisonText}
      </p>

      {/* Mini stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCell label="Your logerror"   value={fmt2(logerror)}          color={barColor(logerror)} />
        <StatCell label="County average"  value={fmt2(countyAvgLogerror)} color="#6b7280" />
        <StatCell label="Difference"      value={fmt2(diff)}              color={diff > 0.005 ? '#ef4444' : diff < -0.005 ? '#3b82f6' : '#10b981'} />
        <StatCell label="Model RMSE"      value="0.0742"                  color="#6b7280" />
      </div>
    </div>
  );
}

function BarRow({
  label, value, barPct, color, bold = false,
}: {
  label: string; value: number; barPct: number; color: string; bold?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className={`text-xs ${bold ? 'text-white font-semibold' : 'text-gray-400'}`}>
          {label}
        </span>
        <span className="text-xs font-mono" style={{ color }}>
          {value >= 0 ? `+${value.toFixed(4)}` : value.toFixed(4)}
        </span>
      </div>
      <div className="relative h-2.5 bg-gray-800 rounded-full overflow-hidden">
        {/* Zero marker */}
        <div className="absolute top-0 bottom-0 w-px bg-gray-600 z-10" style={{ left: '50%' }} />
        {/* Bar — starts from centre */}
        {value >= 0 ? (
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-700"
            style={{
              left:  '50%',
              width: `${Math.abs(barPct - 50)}%`,
              background: color,
              opacity: 0.8,
            }}
          />
        ) : (
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-700"
            style={{
              right: '50%',
              width: `${Math.abs(barPct - 50)}%`,
              background: color,
              opacity: 0.8,
            }}
          />
        )}
      </div>
    </div>
  );
}

function StatCell({
  label, value, color,
}: {
  label: string; value: string; color: string;
}) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 space-y-0.5">
      <p className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="font-mono font-bold text-sm" style={{ color }}>{value}</p>
    </div>
  );
}
