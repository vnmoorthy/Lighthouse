/**
 * Main app shell — sidebar + content.
 *
 * Inspired by minimal "tools without ceremony" UIs (Linear, Things). The
 * left rail collapses to icons under 1024px.
 */
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Receipt, Repeat, Bell, Settings, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, type SummaryResponse } from '../lib/api';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/subscriptions', icon: Repeat, label: 'Subscriptions' },
  { to: '/receipts', icon: Receipt, label: 'Receipts' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const summary = useQuery({
    queryKey: ['summary-mini'],
    queryFn: () => api<SummaryResponse>('/api/summary'),
  });
  const openAlerts = summary.data?.kpis.open_alerts ?? 0;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-lh-line/60 bg-lh-paper/50 flex flex-col">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-lh-gold flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-lh-ink" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">Lighthouse</div>
              <div className="text-[11px] text-lh-mute">v0.3.1 · local</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-lh-line2 text-lh-fore'
                    : 'text-lh-mute hover:text-lh-fore hover:bg-lh-line/40',
                ].join(' ')
              }
            >
              <Icon size={16} />
              <span>{label}</span>
              {to === '/alerts' && openAlerts > 0 ? (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500/20 text-rose-300 text-xs">
                  {openAlerts}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-lh-line/60 text-xs text-lh-mute">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} />
            All data stays on this machine.
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
