'use client';

/**
 * components/PredictionGauge.tsx
 *
 * SVG arc/needle gauge for logerror range [−0.40, +0.40].
 *
 * Left  (blue)  → underpriced  (logerror < 0)
 * Centre(green) → fair          (logerror ≈ 0)
 * Right (red)   → overpriced   (logerror > 0)
 *
 * The needle rotates from -135° (far left) to +135° (far right).
 */

interface PredictionGaugeProps {
  logerror: number; // range ≈ [−0.40, +0.40]
}

const R   = 90;   // arc radius
const CX  = 110;  // centre x
const CY  = 110;  // centre y  (viewBox is 220×140)
const SW  = 18;   // stroke width of arc

/** Convert polar angle (0 = right, CCW) to SVG arc endpoint */
function polarToXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

/** Build a large-arc SVG path between two angles */
function arcPath(startDeg: number, endDeg: number, r: number) {
  const s = polarToXY(startDeg, r);
  const e = polarToXY(endDeg,   r);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = startDeg > endDeg ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} ${sweep} ${e.x} ${e.y}`;
}

// The gauge arc spans from 225° → -45° (i.e. 270° sweep, clockwise)
// In SVG polar: 225° = lower-left, 315° = lower-right
const ARC_START = 225; // left end
const ARC_END   = -45; // right end  (= 315° equiv)

// Map logerror [-0.40, +0.40] → needle angle [225° → -45°]
function logerrorToAngle(val: number): number {
  const clamped = Math.max(-0.40, Math.min(0.40, val));
  const t = (clamped + 0.40) / 0.80; // 0..1
  // Interpolate from 225° to -45° clockwise (decreasing angle)
  return 225 - t * 270;
}

// Segment boundaries (degrees)
// Under: 225° → 135°   (left third)
// Fair:  135° →  45°   (middle third)
// Over:   45° → -45°   (right third)

export default function PredictionGauge({ logerror }: PredictionGaugeProps) {
  const needleAngle = logerrorToAngle(logerror);
  const needleTip   = polarToXY(needleAngle, R - 8);
  const needleBase1 = polarToXY(needleAngle + 90, 10);
  const needleBase2 = polarToXY(needleAngle - 90, 10);

  const displayVal = logerror >= 0
    ? `+${logerror.toFixed(4)}`
    : logerror.toFixed(4);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 220 140"
        width="100%"
        style={{ maxWidth: 300 }}
        aria-label={`Logerror gauge: ${displayVal}`}
      >
        {/* ── Background track ─────────────────────────────────────────── */}
        <path
          d={arcPath(ARC_START, ARC_END, R)}
          fill="none"
          stroke="#1f2937"
          strokeWidth={SW}
          strokeLinecap="round"
        />

        {/* ── Coloured segments ─────────────────────────────────────────── */}
        {/* Blue: underpriced — 225° → 135° */}
        <path
          d={arcPath(225, 135, R)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={SW}
          strokeLinecap="butt"
          opacity={0.85}
        />
        {/* Green: fair — 135° → 45° */}
        <path
          d={arcPath(135, 45, R)}
          fill="none"
          stroke="#10b981"
          strokeWidth={SW}
          strokeLinecap="butt"
          opacity={0.85}
        />
        {/* Red: overpriced — 45° → -45° */}
        <path
          d={arcPath(45, -45, R)}
          fill="none"
          stroke="#ef4444"
          strokeWidth={SW}
          strokeLinecap="butt"
          opacity={0.85}
        />

        {/* ── Tick marks ────────────────────────────────────────────────── */}
        {[-0.40, -0.20, 0, 0.20, 0.40].map((v) => {
          const a = logerrorToAngle(v);
          const inner = polarToXY(a, R - SW / 2 - 4);
          const outer = polarToXY(a, R + SW / 2 + 4);
          return (
            <line
              key={v}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="#374151"
              strokeWidth={2}
            />
          );
        })}

        {/* ── Tick labels ───────────────────────────────────────────────── */}
        {([-0.40, -0.20, 0, 0.20, 0.40] as const).map((v) => {
          const a = logerrorToAngle(v);
          const pos = polarToXY(a, R + SW / 2 + 14);
          return (
            <text
              key={v}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#6b7280"
              fontSize={8}
              fontFamily="monospace"
            >
              {v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)}
            </text>
          );
        })}

        {/* ── Needle ───────────────────────────────────────────────────── */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill="white"
          opacity={0.92}
        />

        {/* ── Centre hub ────────────────────────────────────────────────── */}
        <circle cx={CX} cy={CY} r={7} fill="#111827" stroke="#374151" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={3} fill="#f9fafb" />

        {/* ── Value display ─────────────────────────────────────────────── */}
        <text
          x={CX}
          y={CY + 26}
          textAnchor="middle"
          fill="white"
          fontSize={13}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {displayVal}
        </text>
        <text
          x={CX}
          y={CY + 39}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={7.5}
        >
          logerror
        </text>

        {/* ── End labels ────────────────────────────────────────────────── */}
        <text x={14} y={128} fill="#3b82f6" fontSize={8} fontWeight="600">Under</text>
        <text x={175} y={128} fill="#ef4444" fontSize={8} fontWeight="600">Over</text>
      </svg>

      {/* Legend row */}
      <div className="flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          Under-valued
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          Fair
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          Over-valued
        </span>
      </div>
    </div>
  );
}
