/**
 * Native OS notifications toggle. macOS uses osascript; Linux uses
 * notify-send; Windows is a no-op for now.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../lib/api';

export default function NotificationsToggle() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['notifications-enabled'],
    queryFn: () => api<{ enabled: boolean }>('/api/notifications'),
  });
  const enabled = q.data?.enabled ?? false;
  const set = useMutation({
    mutationFn: (next: boolean) => apiPost('/api/notifications', { enabled: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-enabled'] }),
  });
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1">
        <div className="text-sm text-lh-fore">Native OS notifications</div>
        <div className="text-2xs text-lh-mute mt-0.5 leading-relaxed">
          Show a system toast for every alert. macOS uses
          <code className="text-lh-fore px-1 mx-1 py-0.5 bg-lh-line rounded font-mono text-2xs">osascript</code>;
          Linux uses
          <code className="text-lh-fore px-1 mx-1 py-0.5 bg-lh-line rounded font-mono text-2xs">notify-send</code>.
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => set.mutate(!enabled)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
          enabled ? 'bg-lh-coral' : 'bg-lh-line2'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
            enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
