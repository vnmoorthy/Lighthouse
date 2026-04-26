/**
 * Native OS notifications.
 *
 * - macOS: shells out to `osascript -e 'display notification "…" with title "Lighthouse"'`.
 * - Linux: shells out to `notify-send` if present.
 * - Windows / unknown: no-op (we'd add a PowerShell BurntToast call later).
 *
 * Disabled by default. Enable in Settings; the pipeline calls `notify()`
 * inside the dispatchWebhook hook so users get OS toasts for every alert.
 *
 * We deliberately use `child_process.execFile` (not `exec`) so the
 * arguments aren't interpreted by a shell — no command injection on a
 * crafted alert payload.
 */
import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { kvGet, kvSet } from '../db/kv.js';
import { log } from '../logger.js';

export const NOTIFICATIONS_ENABLED_KEY = 'notifications.enabled';

export function notificationsEnabled(): boolean {
  return kvGet(NOTIFICATIONS_ENABLED_KEY) === '1';
}

export function setNotificationsEnabled(on: boolean): void {
  kvSet(NOTIFICATIONS_ENABLED_KEY, on ? '1' : '0');
}

/** Dispatch a native OS notification. Fire-and-forget; never throws. */
export function notify(title: string, body: string): void {
  if (!notificationsEnabled()) return;
  const p = platform();
  try {
    if (p === 'darwin') {
      // Escape double quotes for embedding in AppleScript string.
      const safeTitle = title.replace(/"/g, '\\"');
      const safeBody = body.replace(/"/g, '\\"');
      const script = `display notification "${safeBody}" with title "Lighthouse" subtitle "${safeTitle}"`;
      execFile('osascript', ['-e', script], (err) => {
        if (err) log.debug(`osascript notify failed: ${err.message}`);
      });
    } else if (p === 'linux') {
      execFile('notify-send', ['Lighthouse — ' + title, body], (err) => {
        if (err) log.debug(`notify-send failed: ${err.message}`);
      });
    }
    // Windows: no-op for now. PowerShell BurntToast would work but adds
    // a dependency users won't have by default.
  } catch (e) {
    log.debug(`notify dispatch failed: ${(e as Error).message}`);
  }
}
