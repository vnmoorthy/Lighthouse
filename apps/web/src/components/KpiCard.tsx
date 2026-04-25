/**
 * KPI card — value + label + optional sparkline + delta.
 *
 * The card becomes interactive when an `href` (or onClick, future) is
 * provided. The hover lifts the shadow rather than scaling the card —
 * scaling on text feels childish.
 */
import type { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Last N values for the sparkline. Optional. */
  trend?: number[];
  /** Percent delta vs prior period. */
  deltaPct?: number;
  /** Higher is bad? Inverts trend coloring (e.g. "expense up = bad"). */
  invertDelta?: boolean;
  icon?: ReactNode;
  accent?: 'gold' | 'mint' | 'azure' | 'violet' | 'rose';
}

const ACCENT_COLOR: Record<NonNullable<Props['accent']>, string> = {
  gold: '#f5b94f',
  mint: '#74c997',
  azure: '#7cc1e9',
  violet: '#b39de0',
  rose: '#e88a91',
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const W = 96;
  const H = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastY = H - ((data[data.length - 1]! - min) / range) * (H - 4) - 2;
  const id = `spark-${color.replace('#', '')}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${H} ${points} ${W},${H}`}
        fill={`url(#${id})`}
        stroke="none"
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={W} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}

function DeltaBadge({ pct, invert }: { pct: number; invert?: boolean }) {
  const isFlat = Math.abs(pct) < 0.5;
  const isUp = pct > 0;
  // "Up" is good for revenue, bad for expenses (invert).
  const tone = isFlat ? 'flat' : (invert ? !isUp : isUp) ? 'good' : 'bad';
  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;
  const cls = {
    good: 'text-emerald-300 bg-emerald-500/10',
    bad: 'text-rose-300 bg-rose-500/10',
    flat: 'text-lh-mute bg-lh-line/40',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-medium tabular-nums ${cls}`}>
      <Icon size={11} strokeWidth={2.5} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function KpiCard({
  label,
  value,
  hint,
  trend,
  deltaPct,
  invertDelta,
  icon,
  accent = 'gold',
}: Props) {
  const color = ACCENT_COLOR[accent];
  return (
    <div className="lh-card-hover p-5 group">
      <div className="flex items-center justify-between mb-3">
        <span className="lh-eyebrow">{label}</span>
        {icon ? <span className="text-lh-mute group-hover:text-lh-fore transition-colors">{icon}</span> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="lh-num text-3xl font-semibold tracking-tightest text-lh-fore">{value}</div>
          {hint ? <div className="text-xs text-lh-mute mt-1">{hint}</div> : null}
        </div>
        {trend && trend.length >= 2 ? (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Sparkline data={trend} color={color} />
            {deltaPct != null ? <DeltaBadge pct={deltaPct} invert={invertDelta} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
