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
      <div className="lh-card p-6 h-72 flex items-center justify-center text-sm text-lh-mute">
        Top merchants will populate after extraction.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.total_cents));
  return (
    <div className="lh-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Top merchants · last 12 months</div>
        <div className="text-xs text-lh-mute">{data.length} of top spenders</div>
      </div>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.merchant_id} className="flex items-center gap-3">
            <MerchantBadge name={d.display_name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{d.display_name}</span>
                <span className="text-lh-mute tabular-nums">{fmtMoney(d.total_cents)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-lh-line/60 mt-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-300"
                  style={{ width: `${Math.max(2, (d.total_cents / max) * 100)}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-lh-mute w-12 text-right">{d.count}×</div>
          </div>
        ))}
      </div>
    </div>
  );
}
