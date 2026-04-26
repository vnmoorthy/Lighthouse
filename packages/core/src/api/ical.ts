/**
 * Generate an .ics calendar feed of every active subscription's next
 * renewal date. Users can subscribe to this from Apple Calendar, Google
 * Calendar, or anything that speaks iCalendar.
 *
 * The token is included in the URL path so the feed itself is accessible
 * with a single GET — calendar clients don't send Authorization headers.
 * Only same-machine clients can reach the API anyway, but we still
 * require knowledge of the bearer token for the URL.
 */
import { listSubscriptions } from '../db/queries.js';

const CRLF = '\r\n';

function fmtIcalDate(ms: number): string {
  // ICS DATE form: YYYYMMDD (we use all-day events to keep clients simple)
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export function buildSubscriptionsIcs(): string {
  const subs = listSubscriptions().filter((s) => s.status === 'active' || s.status === 'trial');
  const lines: string[] = [];
  lines.push(
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lighthouse//Subscription Renewals//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Lighthouse — subscription renewals',
    'X-WR-CALDESC:Auto-generated from your Gmail receipts.',
    'METHOD:PUBLISH',
  );

  for (const s of subs) {
    if (!s.next_renewal_date) continue;
    const dtStart = fmtIcalDate(s.next_renewal_date);
    const next = new Date(s.next_renewal_date);
    next.setUTCDate(next.getUTCDate() + 1);
    const dtEnd = fmtIcalDate(next.getTime());
    const summary =
      s.status === 'trial'
        ? `${s.merchant_display_name} trial ends`
        : `${s.merchant_display_name} renews — $${(s.amount_cents / 100).toFixed(2)}`;
    const description = [
      s.plan_name ? `Plan: ${s.plan_name}` : null,
      `Cycle: ${s.billing_cycle}`,
      `Amount: $${(s.amount_cents / 100).toFixed(2)} ${s.currency}`,
      s.status === 'trial' ? 'Trial converts to paid on this date.' : null,
    ]
      .filter(Boolean)
      .join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:lighthouse-sub-${s.id}@local`,
      `DTSTAMP:${fmtIcalDate(Date.now())}T000000Z`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${escape(summary)}`,
      `DESCRIPTION:${escape(description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(summary)} (tomorrow)`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}
