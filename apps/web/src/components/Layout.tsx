/**
 * App shell — sidebar + main column.
 *
 * Sidebar groups: Workspace (overview/subs/receipts), Notifications (alerts),
 * Settings. Each gets a group header for visual hierarchy. Active state is
 * a tinted slab with a coral accent rail.
 */
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Repeat,
  Bell,
  Settings,
  ShieldCheck,
  Menu,
  X,
  Eye,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, type SummaryResponse } from '../lib/api';
import TrialBanner from './TrialBanner';
import { useEffect } from 'react';

const NAV_GROUPS: {
  label: string;
  items: { to: string; icon: typeof LayoutDashboard; label: string; end?: boolean }[];
}[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Overview', end: true },
      { to: '/subscriptions', icon: Repeat, label: 'Subscriptions' },
      { to: '/receipts', icon: Receipt, label: 'Receipts' },
    ],
  },
  {
    label: 'Watch',
    items: [{ to: '/alerts', icon: Bell, label: 'Alerts' }],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/privacy', icon: Eye, label: 'Privacy' },
    ],
  },
];

export default function Layout() {
  const summary = useQuery({
    queryKey: ['summary-mini'],
    queryFn: () => api<SummaryResponse>('/api/summary'),
  });
  const openAlerts = summary.data?.kpis.open_alerts ?? 0;
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  // Close the mobile sidebar on route change.
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  return (
    <div className="flex min-h-screen lh-page-bg">
      {/* ---- Mobile top bar ---- */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-lh-paper/95 backdrop-blur border-b border-lh-line/60 flex items-center justify-between px-4 h-12">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-lh-gold to-lh-coral flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-lh-ink" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Lighthouse</span>
        </div>
        <button
          type="button"
          aria-label="Toggle menu"
          className="lh-btn-icon"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* ---- Sidebar ---- */}
      <aside
        className={[
          'shrink-0 border-r border-lh-line/60 bg-lh-paper/70 backdrop-blur-sm flex flex-col z-40',
          // Desktop: always visible to the left
          'lg:static lg:translate-x-0 lg:w-60',
          // Mobile: slide-in drawer
          'fixed inset-y-0 left-0 w-72 transition-transform duration-200 ease-spring',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-lh-gold to-lh-coral flex items-center justify-center shadow-[0_0_24px_-4px_rgba(245,185,79,0.5)]">
                <div className="w-3 h-3 rounded-full bg-lh-ink" />
              </div>
              <div className="absolute -inset-1 rounded-full bg-lh-gold/10 blur-md -z-10" />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tightest leading-none">Lighthouse</div>
              <div className="text-2xs text-lh-mute mt-0.5 tabular-nums">v0.25.0 · local</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-2 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 lh-eyebrow">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map(({ to, icon: Icon, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      ['lh-nav', isActive ? 'lh-nav-active' : ''].join(' ')
                    }
                  >
                    <Icon size={15} strokeWidth={1.75} />
                    <span>{label}</span>
                    {to === '/alerts' && openAlerts > 0 ? (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-lh-rose/15 text-lh-rose text-2xs font-medium">
                        {openAlerts}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: cmd-k hint + privacy reassurance */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between text-2xs text-lh-mute mb-3 px-3">
            <span>Search</span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono px-1 py-0.5 rounded bg-lh-line border border-lh-line2">⌘</kbd>
              <kbd className="font-mono px-1 py-0.5 rounded bg-lh-line border border-lh-line2">K</kbd>
            </span>
          </div>
          <div className="p-3 rounded-lg bg-lh-line/30 border border-lh-line/60">
            <div className="flex items-start gap-2">
              <ShieldCheck size={14} className="text-lh-mint mt-0.5 shrink-0" />
              <div className="text-2xs text-lh-mute leading-relaxed">
                All data lives on this machine. Lighthouse never phones home.
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {mobileOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* ---- Main ---- */}
      <main className="flex-1 min-w-0 animate-fade-in pt-12 lg:pt-0">
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}
