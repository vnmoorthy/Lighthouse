/**
 * Top-merchants leaderboard. Custom bars (not Recharts) — we get more
 * typographic control. Each row shows: badge, name, total amount,
 * a horizontal bar normalized to the leader, and the receipt count.
 */
import { fmtMoney } from '../lib/format';
import MerchantBadge from './MerchantBadge';

interface Datum {
  merchant_id: number;
  display_name: string;
  domain: string | null;
  total_cents: number;
  count: number;
}

export default function TopMerchantsBar({ data }: { data: Datum[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="lh-card p-8 h-80 flex flex-col items-center justify-center text-center">
        <div className="text-sm font-medium text-lh-fore mb-1">No merchants yet</div>
        <div className="text-xs text-lh-mute max-w-xs">
          Top merchants will appear after the first sync.
        </div>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.total_cents));
  return (
    <div className="lh-card p-5 h-[340px] flex flex-col">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="lh-eyebrow">Top merchants</div>
          <div className="text-base font-semibold mt-1 text-lh-fore">Last 12 months</div>
        </div>
        <div className="text-2xs text-lh-mute">{data.length} of top spenders</div>
      </div>
      <div className="space-y-2.5 overflow-y-auto -mr-2 pr-2">
        {data.map((d, i) => {
          const pct = (d.total_cents / max) * 100;
          return (
            <div key={d.merchant_id} className="flex items-center gap-3 group">
              <div className="text-2xs text-lh-mute w-3 tabular-nums">{i + 1}</div>
              <MerchantBadge name={d.display_name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-lh-fore group-hover:text-lh-coral transition-colors">{d.display_name}</span>
                  <span className="text-lh-mute lh-num text-xs">{fmtMoney(d.total_cents)}</span>
                </div>
                <div className="h-[3px] rounded-full bg-lh-line/60 mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-lh-gold via-lh-coral to-lh-rose transition-all duration-700 ease-spring"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
              <div className="text-2xs text-lh-mute w-10 text-right tabular-nums shrink-0">{d.count}×</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
