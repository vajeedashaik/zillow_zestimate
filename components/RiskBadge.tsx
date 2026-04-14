'use client';

/**
 * components/RiskBadge.tsx
 *
 * Large pill badge indicating whether the Zestimate is OVERPRICED, FAIR,
 * or UNDERPRICED. Colour-coded: red / green / blue.
 */

interface RiskBadgeProps {
  label: 'OVERPRICED' | 'FAIR' | 'UNDERPRICED';
  percentageDeviation: number; // positive = actual higher than Zestimate
  size?: 'sm' | 'lg';
}

const CONFIG = {
  OVERPRICED: {
    bg:     'bg-red-500/15',
    border: 'border-red-500/50',
    text:   'text-red-400',
    dot:    'bg-red-500',
    icon:   '↑',
    label:  'OVERPRICED',
    sub:    'Zestimate above market',
  },
  FAIR: {
    bg:     'bg-emerald-500/15',
    border: 'border-emerald-500/50',
    text:   'text-emerald-400',
    dot:    'bg-emerald-500',
    icon:   '≈',
    label:  'FAIR',
    sub:    'Estimate within normal range',
  },
  UNDERPRICED: {
    bg:     'bg-blue-500/15',
    border: 'border-blue-500/50',
    text:   'text-blue-400',
    dot:    'bg-blue-500',
    icon:   '↓',
    label:  'UNDERPRICED',
    sub:    'Zestimate below market',
  },
} as const;

export default function RiskBadge({
  label,
  percentageDeviation,
  size = 'lg',
}: RiskBadgeProps) {
  const c = CONFIG[label];
  const absDeviation = Math.abs(percentageDeviation).toFixed(1);

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${c.bg} ${c.border} ${c.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {c.label}
      </span>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl border-2 p-6 flex flex-col items-center gap-3 ${c.bg} ${c.border}`}
    >
      {/* Icon circle */}
      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black ${c.bg} border ${c.border} ${c.text}`}>
        {c.icon}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className={`text-2xl font-black tracking-widest ${c.text}`}>
          {c.label}
        </p>
        <p className="text-gray-400 text-sm mt-0.5">{c.sub}</p>
      </div>

      {/* Deviation pill */}
      <div className={`px-4 py-1.5 rounded-full border text-sm font-semibold ${c.bg} ${c.border} ${c.text}`}>
        {label === 'OVERPRICED'
          ? `Zestimate ~${absDeviation}% above likely sale price`
          : label === 'UNDERPRICED'
          ? `Zestimate ~${absDeviation}% below likely sale price`
          : `Estimate within ±${absDeviation}% of likely sale price`}
      </div>
    </div>
  );
}
