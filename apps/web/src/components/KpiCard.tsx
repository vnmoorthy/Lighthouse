import type { ReactNode } from 'react';

export default function KpiCard({
  label,
  value,
  hint,
  trend,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: ReactNode;
}) {
  return (
    <div className="lh-card p-5">
      <div className="flex items-center justify-between text-xs text-lh-mute uppercase tracking-wider">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        {trend ? (
          <span
            className={
              trend === 'up'
                ? 'text-rose-400 text-sm'
                : trend === 'down'
                ? 'text-emerald-400 text-sm'
                : 'text-lh-mute text-sm'
            }
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '·'}
          </span>
        ) : null}
      </div>
      {hint ? <div className="text-xs text-lh-mute mt-1">{hint}</div> : null}
    </div>
  );
}
