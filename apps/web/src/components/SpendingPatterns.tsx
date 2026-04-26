/**
 * Spending patterns: when do you actually spend?
 *
 * Two stacked rows:
 *   1. Day of week — 7 vertical bars, one per weekday.
 *   2. Hour of day — 24 horizontal cells in a single row, intensity-tinted.
 *
 * Both visualisations highlight the bucket with the highest count or
 * total, so the user can immediately see the takeaway ("Tuesday is your
 * biggest day", "9pm is your DoorDash hour").
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmtMoney } from '../lib/format';

interface Patterns {
  by_dow: { dow: number; total_cents: number; count: number }[];
  by_hour: { hour: number; total_cents: number; count: number }[];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLOR = '#e58e5a';

export default function SpendingPatterns() {
  const q = useQuery({
    queryKey: ['patterns'],
    queryFn: () => api<Patterns>('/api/patterns'),
  });

  if (q.isLoading) return null;
  if (!q.data) return null;
  const { by_dow, by_hour } = q.data;
  const dowMax = Math.max(1, ...by_dow.map((d) => d.total_cents));
  const hourMax = Math.max(1, ...by_hour.map((h) => h.total_cents));
  if (dowMax === 1 && hourMax === 1) return null;

  const peakDow = by_dow.reduce((a, b) => (b.total_cents > a.total_cents ? b : a), by_dow[0]!);
  const peakHour = by_hour.reduce((a, b) => (b.total_cents > a.total_cents ? b : a), by_hour[0]!);

  return (
    <div className="lh-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="lh-eyebrow">Spending patterns</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">When do you actually spend?</div>
        </div>
        <div className="text-2xs text-lh-mute">last 12 months</div>
      </div>

      {/* Day of week */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <div className="lh-eyebrow text-[10px]">By weekday</div>
          <div className="text-2xs text-lh-mute">
            Peak: <span className="text-lh-fore font-medium">{DOW[peakDow.dow]}</span>{' '}
            ({fmtMoney(peakDow.total_cents)})
          </div>
        </div>
        <div className="flex items-end gap-2 h-20">
          {by_dow.map((d) => {
            const pct = (d.total_cents / dowMax) * 100;
            const isPeak = d.dow === peakDow.dow;
            return (
              <div key={d.dow} className="flex-1 flex flex-col items-center gap-1.5 group min-w-0">
                <div className="flex-1 w-full flex items-end" title={`${DOW[d.dow]}: ${fmtMoney(d.total_cents)} · ${d.count} receipts`}>
                  <div
                    className="w-full rounded-t-sm transition-colors"
                    style={{
                      height: `${Math.max(2, pct)}%`,
                      background: isPeak ? COLOR : '#272d39',
                    }}
                  />
                </div>
                <div className="text-[10px] text-lh-mute lh-num">{DOW[d.dow]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hour of day */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="lh-eyebrow text-[10px]">By hour</div>
          <div className="text-2xs text-lh-mute">
            Peak: <span className="text-lh-fore font-medium">{formatHour(peakHour.hour)}</span>{' '}
            ({fmtMoney(peakHour.total_cents)})
          </div>
        </div>
        <div className="grid grid-cols-24 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {by_hour.map((h) => {
            const ratio = h.total_cents / hourMax;
            const opacity = Math.max(0.06, ratio);
            return (
              <div
                key={h.hour}
                className="h-7 rounded-[3px] transition-opacity hover:ring-1 hover:ring-lh-coral cursor-default"
                style={{ background: COLOR, opacity }}
                title={`${formatHour(h.hour)}: ${fmtMoney(h.total_cents)} · ${h.count} receipts`}
              />
            );
          })}
        </div>
        <div className="grid grid-cols-24 gap-[3px] mt-1 text-[9px] text-lh-mute" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {by_hour.map((h) => (
            <div key={h.hour} className="text-center">{h.hour % 6 === 0 ? formatHour(h.hour) : ''}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
