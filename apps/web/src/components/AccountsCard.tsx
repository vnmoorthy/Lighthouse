/**
 * Accounts widget. Shows the connected Gmail accounts. v0.20 ships
 * read-only — adding a second account requires re-running setup, which
 * a future release will streamline.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmtRelative } from '../lib/format';
import { AtSign } from 'lucide-react';

interface Account {
  id: number;
  label: string;
  email: string | null;
  color: string;
  is_default: number;
  created_at: number;
}

export default function AccountsCard() {
  const q = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api<{ accounts: Account[] }>('/api/accounts'),
  });
  const list = q.data?.accounts ?? [];
  if (q.isLoading) return null;

  return (
    <div className="space-y-3">
      <div className="lh-card divide-y divide-lh-line/40">
        {list.length === 0 ? (
          <div className="px-4 py-3 text-sm text-lh-mute">No accounts connected yet.</div>
        ) : (
          list.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center gap-3">
              <span
                className="w-2 h-8 rounded-full shrink-0"
                style={{ background: a.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-lh-fore">{a.label}</span>
                  {a.is_default ? (
                    <span className="lh-pill bg-lh-line/40 text-lh-mute text-2xs">default</span>
                  ) : null}
                </div>
                <div className="text-2xs text-lh-mute mt-0.5 flex items-center gap-1.5">
                  <AtSign size={10} />
                  {a.email ?? '— not connected'}
                  <span>·</span>
                  added {fmtRelative(a.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="text-2xs text-lh-mute">
        Multi-account support is in foundational mode in v0.20: the schema and
        APIs are ready, but adding a second inbox still requires re-running{' '}
        <code className="text-lh-fore px-1 py-0.5 bg-lh-line rounded font-mono">npm run setup</code>.
        A streamlined add-account command is on the roadmap.
      </div>
    </div>
  );
}
