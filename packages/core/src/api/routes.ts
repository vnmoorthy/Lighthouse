/**
 * REST routes consumed by the dashboard.
 *
 * Each handler reshapes DB rows into a stable wire format that the SPA
 * renders without needing to know about table columns. We keep response
 * shapes flat (no nested merchant objects, etc.) to make the front-end
 * trivial.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  addReceiptTags,
  countEmailsByStatus,
  dismissAlert,
  getReceiptTags,
  listAllTagsWithCounts,
  removeReceiptTag,
  getCategoryBreakdown,
  getEmailById,
  getMonthlyTotals,
  getReceiptById,
  getSpendingPatterns,
  getSubscriptionById,
  getMerchantTimeline,
  getSubscriptionHealth,
  getSyncRun,
  getTopMerchants,
  getYearOverYear,
  listMerchants,
  listOpenAlerts,
  listReceipts,
  listSubscriptions,
  listChargesForSubscription,
  setSubscriptionStatus,
} from '../db/queries.js';
import { kvGet, KV_KEYS } from '../db/kv.js';
import { config } from '../config.js';
import { toMonthlyCents } from '../domain/currency.js';
import { getCancelLink } from '../domain/cancel_links.js';
import { getInsights } from '../domain/insights.js';
import {
  createCustomRule,
  deleteCustomRule,
  evaluateCustomRules,
  listCustomRules,
  toggleCustomRule,
  type RuleType,
} from '../domain/custom_alerts.js';
import {
  deleteBudget,
  getBudgetProgress,
  upsertBudget,
} from '../domain/budgets.js';
import { getMerchantById } from '../db/queries.js';
import { kvGet as kvGetForIcal } from '../db/kv.js';
import { buildSubscriptionsIcs } from './ical.js';
import { syncOrchestrator } from './sync_orchestrator.js';
import { log } from '../logger.js';

function ms(d: number | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

interface ReceiptListQuery {
  from?: string;
  to?: string;
  merchant?: string;
  category?: string;
  tag?: string;
  q?: string;
  limit?: string;
  offset?: string;
}

export function registerRoutes(app: FastifyInstance): void {
  // --- Health ----------------------------------------------------------
  app.get('/api/health', async () => ({
    ok: true,
    version: '0.1.0',
    db: config.dbPath,
    user: kvGet(KV_KEYS.gmailUserEmail),
    last_sync: kvGet(KV_KEYS.syncLastFinishedAt),
  }));

  // --- Summary ---------------------------------------------------------
  app.get('/api/summary', async () => {
    const monthly = getMonthlyTotals(12);
    const top = getTopMerchants(10, 365);
    const categories = getCategoryBreakdown(365);
    const yoy = getYearOverYear();
    const allActive = listSubscriptions('active');
    const trial = listSubscriptions('trial');

    const monthly_cost_cents = allActive.reduce(
      (acc, s) => acc + toMonthlyCents(s.amount_cents, s.billing_cycle),
      0,
    );
    const annual_run_rate_cents = monthly_cost_cents * 12;
    const last30d_cents = monthly.length > 0 ? monthly[monthly.length - 1]!.total_cents : 0;

    const counts = countEmailsByStatus();
    const openAlertsCount = listOpenAlerts().length;

    return {
      monthly_spend: monthly.map((m) => ({
        month: m.month,
        total_cents: m.total_cents,
        count: m.count,
      })),
      top_merchants: top.map((m) => ({
        merchant_id: m.merchant_id,
        display_name: m.display_name,
        domain: m.domain,
        total_cents: m.total_cents,
        count: m.count,
      })),
      kpis: {
        last_30d_cents: last30d_cents,
        active_subscriptions: allActive.length,
        trial_subscriptions: trial.length,
        monthly_subscription_cost_cents: monthly_cost_cents,
        annual_run_rate_cents,
        open_alerts: openAlertsCount,
      },
      email_processing: counts,
      categories,
      year_over_year: yoy,
    };
  });

  // --- Receipts --------------------------------------------------------
  app.get(
    '/api/receipts',
    async (req: FastifyRequest<{ Querystring: ReceiptListQuery }>) => {
      const q = req.query;
      const result = listReceipts({
        from: q.from ? Number.parseInt(q.from, 10) : null,
        to: q.to ? Number.parseInt(q.to, 10) : null,
        merchantId: q.merchant ? Number.parseInt(q.merchant, 10) : null,
        category: q.category ?? null,
        tag: q.tag ?? null,
        q: q.q ?? null,
        limit: q.limit ? Number.parseInt(q.limit, 10) : 50,
        offset: q.offset ? Number.parseInt(q.offset, 10) : 0,
      });
      return {
        total: result.total,
        receipts: result.rows.map((r) => ({
          id: r.id,
          email_id: r.email_id,
          merchant_id: r.merchant_id,
          merchant_display_name: r.merchant_display_name,
          merchant_domain: r.merchant_domain,
          total_amount_cents: r.total_amount_cents,
          currency: r.currency,
          transaction_date: r.transaction_date,
          order_number: r.order_number,
          payment_method: r.payment_method,
          confidence: r.confidence,
        })),
      };
    },
  );

  app.get(
    '/api/receipts/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const r = getReceiptById(id);
      if (!r) return reply.code(404).send({ error: 'not_found' });
      const email = getEmailById(r.email_id);
      return {
        ...r,
        line_items: r.line_items_json ? JSON.parse(r.line_items_json) : null,
        email: email
          ? {
              id: email.id,
              from_address: email.from_address,
              from_name: email.from_name,
              subject: email.subject,
              internal_date: email.internal_date,
              gmail_message_id: email.gmail_message_id,
              gmail_thread_id: email.gmail_thread_id,
              gmail_url: `https://mail.google.com/mail/u/0/#inbox/${email.gmail_thread_id}`,
            }
          : null,
      };
    },
  );

  // --- Subscriptions ---------------------------------------------------
  const subStatusSchema = z.enum(['active', 'cancelled', 'trial', 'unknown']).optional();

  app.get(
    '/api/subscriptions',
    async (req: FastifyRequest<{ Querystring: { status?: string } }>) => {
      const parsed = subStatusSchema.safeParse(req.query.status);
      const status = parsed.success ? parsed.data : undefined;
      const subs = listSubscriptions(status);
      return {
        subscriptions: subs.map((s) => ({
          id: s.id,
          merchant_id: s.merchant_id,
          merchant_display_name: s.merchant_display_name,
          merchant_domain: s.merchant_domain,
          plan_name: s.plan_name,
          amount_cents: s.amount_cents,
          currency: s.currency,
          billing_cycle: s.billing_cycle,
          monthly_cost_cents: toMonthlyCents(s.amount_cents, s.billing_cycle),
          status: s.status,
          next_renewal_date: s.next_renewal_date,
          trial_end_date: s.trial_end_date,
          first_seen_email_id: s.first_seen_email_id,
          last_seen_email_id: s.last_seen_email_id,
          created_at: s.created_at,
          updated_at: s.updated_at,
        })),
      };
    },
  );

  app.get(
    '/api/subscriptions/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const s = getSubscriptionById(id);
      if (!s) return reply.code(404).send({ error: 'not_found' });
      const charges = listChargesForSubscription(id);
      const lastEmail = s.last_seen_email_id ? getEmailById(s.last_seen_email_id) : null;
      const merchant = getMerchantById(s.merchant_id);
      const cancel_link = getCancelLink(merchant?.canonical_name);
      return {
        ...s,
        monthly_cost_cents: toMonthlyCents(s.amount_cents, s.billing_cycle),
        charges,
        cancel_link,
        proof_email: lastEmail
          ? {
              id: lastEmail.id,
              subject: lastEmail.subject,
              from_address: lastEmail.from_address,
              internal_date: lastEmail.internal_date,
            }
          : null,
      };
    },
  );

  app.get('/api/subscriptions-health', async () => getSubscriptionHealth());

  app.get('/api/insights', async () => ({ insights: getInsights(6) }));

  app.get('/api/patterns', async () => getSpendingPatterns());

  // --- Forwarded-email ingest -----------------------------------------
  // POST a raw email body (or just the plaintext) and the pipeline runs
  // it through classify+extract synchronously. Useful for non-Gmail
  // accounts (Outlook, Yahoo, iCloud) where the user can set up a
  // forwarding rule to a local handler.
  app.post(
    '/api/ingest/email',
    async (
      req: FastifyRequest<{
        Body: {
          from: string;
          subject?: string;
          body_text?: string;
          body_html?: string;
          internal_date?: number;
        };
      }>,
      reply,
    ) => {
      const { from, subject, body_text, body_html, internal_date } = req.body ?? {} as Record<string, unknown> as {
        from: string;
        subject?: string;
        body_text?: string;
        body_html?: string;
        internal_date?: number;
      };
      if (!from) return reply.code(400).send({ error: 'missing_from' });
      if (!body_text && !body_html) {
        return reply.code(400).send({ error: 'missing_body' });
      }
      const { ingestForwardedEmail } = await import('../pipeline/ingest_forwarded.js');
      try {
        const out = await ingestForwardedEmail({
          from,
          subject: subject ?? null,
          body_text: body_text ?? null,
          body_html: body_html ?? null,
          internal_date: internal_date ?? Date.now(),
        });
        return out;
      } catch (e) {
        return reply.code(500).send({ error: 'ingest_failed', message: (e as Error).message });
      }
    },
  );

  // --- Accounts -------------------------------------------------------
  app.get('/api/accounts', async () => {
    const { listAccounts } = await import('../db/accounts.js');
    return { accounts: listAccounts() };
  });

  // --- Notifications --------------------------------------------------
  app.get('/api/notifications', async () => {
    const { notificationsEnabled } = await import('../domain/notifications.js');
    return { enabled: notificationsEnabled() };
  });
  app.post(
    '/api/notifications',
    async (req: FastifyRequest<{ Body: { enabled: boolean } }>) => {
      const { setNotificationsEnabled } = await import('../domain/notifications.js');
      setNotificationsEnabled(Boolean(req.body?.enabled));
      return { ok: true };
    },
  );

  // --- Webhook --------------------------------------------------------
  app.get('/api/webhook', async () => {
    const { getWebhookUrl } = await import('../domain/webhooks.js');
    return { url: getWebhookUrl() };
  });
  app.post(
    '/api/webhook',
    async (req: FastifyRequest<{ Body: { url: string | null } }>, reply) => {
      try {
        const { setWebhookUrl } = await import('../domain/webhooks.js');
        setWebhookUrl(req.body?.url ?? null);
        return { ok: true };
      } catch (e) {
        return reply.code(400).send({ error: 'invalid', message: (e as Error).message });
      }
    },
  );
  app.post('/api/webhook/test', async () => {
    const { dispatchWebhook } = await import('../domain/webhooks.js');
    dispatchWebhook({
      type: 'alert',
      alert_type: 'custom',
      subject_table: 'test',
      subject_id: 0,
      payload: { rule_name: 'Lighthouse webhook test', test: true },
      created_at: Date.now(),
      source: 'lighthouse',
      version: '0.21.0',
    });
    return { ok: true };
  });

  // --- Custom alert rules ---------------------------------------------
  app.get('/api/custom-rules', async () => ({ rules: listCustomRules() }));

  app.post(
    '/api/custom-rules',
    async (
      req: FastifyRequest<{ Body: { name: string; type: RuleType; payload: unknown } }>,
      reply,
    ) => {
      try {
        const id = createCustomRule(req.body);
        return { id };
      } catch (e) {
        return reply.code(400).send({ error: 'invalid', message: (e as Error).message });
      }
    },
  );

  app.delete(
    '/api/custom-rules/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      deleteCustomRule(Number.parseInt(req.params.id, 10));
      return { ok: true };
    },
  );

  app.post(
    '/api/custom-rules/:id/toggle',
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: { enabled: boolean } }>,
    ) => {
      toggleCustomRule(Number.parseInt(req.params.id, 10), req.body?.enabled ?? true);
      return { ok: true };
    },
  );

  app.post('/api/custom-rules/evaluate', async () => evaluateCustomRules());

  // --- Budgets --------------------------------------------------------
  app.get('/api/budgets', async () => ({ budgets: getBudgetProgress() }));

  app.post(
    '/api/budgets',
    async (
      req: FastifyRequest<{ Body: { category: string; amount_cents: number } }>,
      reply,
    ) => {
      const { category, amount_cents } = req.body ?? {};
      if (!category || !Number.isFinite(amount_cents) || amount_cents <= 0) {
        return reply.code(400).send({ error: 'invalid' });
      }
      return upsertBudget(category, amount_cents);
    },
  );

  app.delete(
    '/api/budgets/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      deleteBudget(Number.parseInt(req.params.id, 10));
      return { ok: true };
    },
  );

  // --- Tags -----------------------------------------------------------
  app.get('/api/tags', async () => ({ tags: listAllTagsWithCounts() }));

  app.get(
    '/api/receipts/:id/tags',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      const id = Number.parseInt(req.params.id, 10);
      return { tags: getReceiptTags(id) };
    },
  );

  app.post(
    '/api/receipts/:id/tags',
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: { tags: string[] } }>,
    ) => {
      const id = Number.parseInt(req.params.id, 10);
      addReceiptTags(id, req.body?.tags ?? []);
      return { tags: getReceiptTags(id) };
    },
  );

  app.delete(
    '/api/receipts/:id/tags/:tag',
    async (
      req: FastifyRequest<{ Params: { id: string; tag: string } }>,
    ) => {
      const id = Number.parseInt(req.params.id, 10);
      removeReceiptTag(id, decodeURIComponent(req.params.tag));
      return { tags: getReceiptTags(id) };
    },
  );

  app.post(
    '/api/subscriptions/:id/mark-cancelled',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const s = getSubscriptionById(id);
      if (!s) return reply.code(404).send({ error: 'not_found' });
      setSubscriptionStatus(id, 'cancelled');
      return { ok: true };
    },
  );

  // --- Alerts ----------------------------------------------------------
  app.get('/api/alerts', async () => ({
    alerts: listOpenAlerts().map((a) => ({
      id: a.id,
      type: a.type,
      subject_id: a.subject_id,
      subject_table: a.subject_table,
      payload: JSON.parse(a.payload_json),
      created_at: a.created_at,
    })),
  }));

  app.post(
    '/api/alerts/:id/dismiss',
    async (req: FastifyRequest<{ Params: { id: string } }>) => {
      dismissAlert(Number.parseInt(req.params.id, 10));
      return { ok: true };
    },
  );

  // --- Email raw view --------------------------------------------------
  app.get(
    '/api/email/:id/raw',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const e = getEmailById(id);
      if (!e) return reply.code(404).send({ error: 'not_found' });
      return {
        id: e.id,
        gmail_message_id: e.gmail_message_id,
        gmail_thread_id: e.gmail_thread_id,
        gmail_url: `https://mail.google.com/mail/u/0/#inbox/${e.gmail_thread_id}`,
        from_address: e.from_address,
        from_name: e.from_name,
        subject: e.subject,
        internal_date: e.internal_date,
        body_text: e.body_text,
        body_html: e.body_html,
      };
    },
  );

  // --- Merchants -------------------------------------------------------
  app.get('/api/merchants', async () => ({
    merchants: listMerchants().map((m) => ({
      id: m.id,
      display_name: m.display_name,
      canonical_name: m.canonical_name,
      domain: m.domain,
      category: m.category,
    })),
  }));

  app.get(
    '/api/merchants/:id/timeline',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const t = getMerchantTimeline(id);
      if (!t) return reply.code(404).send({ error: 'not_found' });
      return t;
    },
  );

  // --- Sync ------------------------------------------------------------
  app.post('/api/sync', async () => {
    const id = await syncOrchestrator.kick();
    return { id };
  });

  app.get(
    '/api/sync/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = Number.parseInt(req.params.id, 10);
      const r = getSyncRun(id);
      if (!r) return reply.code(404).send({ error: 'not_found' });
      return {
        ...r,
        started_iso: ms(r.started_at),
        finished_iso: ms(r.finished_at),
      };
    },
  );

  // --- iCal feed of subscription renewals ------------------------------
  app.get(
    '/api/calendar/:token.ics',
    async (_req, reply) => {
      const ics = buildSubscriptionsIcs();
      return reply.type('text/calendar; charset=utf-8').send(ics);
    },
  );
  // Convenience JSON endpoint that returns the ready-to-use feed URL the
  // user should paste into their calendar app.
  app.get('/api/calendar-url', async () => {
    const t = kvGetForIcal('api.bearer_token') ?? '';
    return {
      url: `http://${config.api.host}:${config.api.port}/api/calendar/${t}.ics`,
    };
  });

  // --- Settings / wipe -------------------------------------------------
  app.get('/api/settings', async () => ({
    user: kvGet(KV_KEYS.gmailUserEmail),
    last_sync_at: kvGet(KV_KEYS.syncLastFinishedAt),
    llm_provider: config.llm.provider,
    llm_model:
      config.llm.provider === 'anthropic' ? config.llm.anthropic.model : config.llm.ollama.model,
    db_path: config.dbPath,
    api: { host: config.api.host, port: config.api.port },
  }));

  app.setErrorHandler((err: Error, _req, reply) => {
    log.error(`API error: ${err.message}`, { stack: err.stack });
    void reply.code(500).send({ error: 'server_error', message: err.message });
  });
}
