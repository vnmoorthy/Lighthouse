/**
 * Cmd-K command palette.
 *
 * Searches across:
 *   - Pages (Overview, Subscriptions, Receipts, Alerts, Settings)
 *   - Categories (jump to /receipts?category=…)
 *   - Merchants (jump to a filtered receipts view by merchant id)
 *   - Subscriptions (open detail)
 *   - Receipts (open modal)
 *
 * Keyboard: ↑/↓ navigate, Enter activate, Esc close. Plain text fuzzy
 * scoring: prefer prefix matches, then substring matches.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  api,
  type MerchantItem,
  type ReceiptListItem,
  type SubscriptionListItem,
} from '../lib/api';
import {
  Search,
  LayoutDashboard,
  Receipt,
  Repeat,
  Bell,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { CATEGORY_LABEL, categoryColor } from './CategoryBreakdown';
import { fmtMoney } from '../lib/format';

type Item =
  | { kind: 'page'; label: string; to: string; icon: typeof Search; group: string }
  | { kind: 'category'; label: string; key: string; group: string }
  | { kind: 'merchant'; id: number; label: string; group: string }
  | { kind: 'subscription'; id: number; label: string; subtitle: string; group: string }
  | { kind: 'receipt'; id: number; label: string; subtitle: string; group: string };

const PAGE_ITEMS: Extract<Item, { kind: 'page' }>[] = [
  { kind: 'page', label: 'Overview',      to: '/',              icon: LayoutDashboard, group: 'Navigate' },
  { kind: 'page', label: 'Subscriptions', to: '/subscriptions', icon: Repeat,         group: 'Navigate' },
  { kind: 'page', label: 'Receipts',      to: '/receipts',      icon: Receipt,        group: 'Navigate' },
  { kind: 'page', label: 'Alerts',        to: '/alerts',        icon: Bell,           group: 'Navigate' },
  { kind: 'page', label: 'Settings',      to: '/settings',      icon: Settings,       group: 'Navigate' },
];

function score(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 1000;
  if (h.startsWith(n)) return 200;
  const idx = h.indexOf(n);
  if (idx >= 0) return 100 - idx;
  // Word-boundary match.
  const words = h.split(/\s+/);
  if (words.some((w) => w.startsWith(n))) return 80;
  // Char-by-char fuzzy: every char of n must appear in order in h.
  let p = 0;
  for (const c of n) {
    p = h.indexOf(c, p) + 1;
    if (p === 0) return 0;
  }
  return 10;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Open with cmd-k / ctrl-k. Close with escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [open]);

  // Lazy-load search corpora when palette is open.
  const merchants = useQuery({
    queryKey: ['palette-merchants'],
    queryFn: () => api<{ merchants: MerchantItem[] }>('/api/merchants'),
    enabled: open,
  });
  const subs = useQuery({
    queryKey: ['palette-subs'],
    queryFn: () => api<{ subscriptions: SubscriptionListItem[] }>('/api/subscriptions'),
    enabled: open,
  });
  const receipts = useQuery({
    queryKey: ['palette-receipts', q],
    queryFn: () =>
      api<{ total: number; receipts: ReceiptListItem[] }>(
        `/api/receipts?limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
    enabled: open && q.length >= 2,
  });

  const items: Item[] = useMemo(() => {
    const cat: Item[] = Object.entries(CATEGORY_LABEL).map(([key, label]) => ({
      kind: 'category' as const,
      key,
      label,
      group: 'Categories',
    }));
    const mer: Item[] = (merchants.data?.merchants ?? []).map((m) => ({
      kind: 'merchant' as const,
      id: m.id,
      label: m.display_name,
      group: 'Merchants',
    }));
    const sub: Item[] = (subs.data?.subscriptions ?? []).map((s) => ({
      kind: 'subscription' as const,
      id: s.id,
      label: s.merchant_display_name,
      subtitle: `${fmtMoney(s.monthly_cost_cents, s.currency)}/mo · ${s.status}`,
      group: 'Subscriptions',
    }));
    const rec: Item[] = (receipts.data?.receipts ?? []).map((r) => ({
      kind: 'receipt' as const,
      id: r.id,
      label: r.merchant_display_name,
      subtitle: `${fmtMoney(r.total_amount_cents, r.currency)} · ${new Date(r.transaction_date).toLocaleDateString()}`,
      group: 'Receipts',
    }));
    return [...PAGE_ITEMS, ...cat, ...mer, ...sub, ...rec];
  }, [merchants.data, subs.data, receipts.data]);

  const filtered = useMemo(() => {
    if (!q) return items.filter((i) => i.kind === 'page' || i.kind === 'category').slice(0, 14);
    return items
      .map((i) => ({ i, s: score(i.label, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 24)
      .map((x) => x.i);
  }, [items, q]);

  // Group results by `group`.
  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of filtered) {
      const arr = m.get(it.group) ?? [];
      arr.push(it);
      m.set(it.group, arr);
    }
    return [...m.entries()];
  }, [filtered]);

  function activate(i: Item) {
    setOpen(false);
    if (i.kind === 'page') navigate(i.to);
    else if (i.kind === 'category') navigate(`/receipts?category=${i.key}`);
    else if (i.kind === 'merchant') navigate(`/receipts?merchant=${i.id}`);
    else if (i.kind === 'subscription') navigate(`/subscriptions?status=all&open=${i.id}`);
    else if (i.kind === 'receipt') navigate(`/receipts?open=${i.id}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const i = filtered[active];
      if (i) activate(i);
    }
  }

  if (!open) return null;
  let runningIndex = 0;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[15vh] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 lh-card-elev animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-lh-line/60">
          <Search size={16} className="text-lh-mute shrink-0" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Search merchants, subscriptions, receipts, pages…"
            className="flex-1 bg-transparent border-0 outline-none py-3.5 text-sm placeholder:text-lh-mute focus:ring-0"
          />
          <kbd className="text-2xs text-lh-mute font-mono px-1.5 py-0.5 rounded bg-lh-line border border-lh-line2">
            esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-lh-mute">
              No matches. Try a merchant name or category.
            </div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} className="px-2 mb-2">
                <div className="lh-eyebrow px-2 py-1.5">{group}</div>
                {list.map((i) => {
                  const idx = runningIndex++;
                  return <Row key={idx} item={i} active={idx === active} onClick={() => activate(i)} />;
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-lh-line/60 px-4 py-2 flex items-center justify-between text-2xs text-lh-mute">
          <span className="flex items-center gap-2">
            <kbd className="font-mono px-1 py-0.5 rounded bg-lh-line border border-lh-line2">↑↓</kbd> navigate
            <kbd className="font-mono px-1 py-0.5 rounded bg-lh-line border border-lh-line2">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono px-1 py-0.5 rounded bg-lh-line border border-lh-line2">⌘ K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ item, active, onClick }: { item: Item; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${active ? 'bg-lh-line2/70' : 'hover:bg-lh-line/40'}`}
    >
      <Icon item={item} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-lh-fore truncate">{item.label}</div>
        {(item.kind === 'subscription' || item.kind === 'receipt') && item.subtitle ? (
          <div className="text-2xs text-lh-mute truncate">{item.subtitle}</div>
        ) : null}
      </div>
      <ArrowRight size={12} className="text-lh-mute opacity-0 group-hover:opacity-100" />
    </button>
  );
}

function Icon({ item }: { item: Item }) {
  if (item.kind === 'page') {
    const Ic = item.icon;
    return <Ic size={14} className="text-lh-mute" strokeWidth={1.75} />;
  }
  if (item.kind === 'category') {
    return <span className="w-2 h-2 rounded-sm" style={{ background: categoryColor(item.key) }} />;
  }
  if (item.kind === 'merchant') {
    return <span className="w-2 h-2 rounded-sm bg-lh-azure" />;
  }
  if (item.kind === 'subscription') return <Repeat size={14} className="text-lh-coral" strokeWidth={1.75} />;
  if (item.kind === 'receipt') return <Receipt size={14} className="text-lh-mute" strokeWidth={1.75} />;
  return null;
}
