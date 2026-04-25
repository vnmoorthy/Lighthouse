# Changelog

## 0.1.0 — initial release

The first end-to-end version of Lighthouse.

**Core**
- SQLite schema covering emails, merchants, receipts, subscriptions, charges, alerts, sync runs.
- Idempotent migration runner.
- Argon2id-derived AES-256-GCM vault for encrypted token storage.
- KV-backed configuration store.

**Gmail**
- Desktop OAuth flow (random localhost port, browser open, code → token exchange).
- Read-only `gmail.readonly` scope.
- MIME tree parser with text/HTML body extraction.
- Incremental sync via internal-date cursor.
- Exponential backoff with jitter on 429/5xx.

**LLM extraction**
- Anthropic Claude Haiku 4.5 by default; Ollama supported via `LLM_PROVIDER=ollama`.
- Stage-1 classifier with sha256-based content cache.
- Stage-2 receipt extractor with Zod-validated structured output.
- Stage-3 subscription event extractor.
- Stage-4 merchant normalizer with hand-written rules for ~70 top merchants and an LLM fallback (cached forever).

**Pipeline**
- Concurrency-bounded orchestrator with retries and clean progress UI.
- Subscription dedupe pass.
- Alerts engine: trial endings, price increases, new subscriptions, duplicate charges. 30-day suppression to avoid noise.

**API + dashboard**
- Fastify server bound to localhost only, with same-machine bearer-token auth.
- React + Vite + Tailwind SPA. TanStack Query, React Router, Recharts, lucide-react.
- Pages: Overview, Subscriptions, Receipts, Alerts, Settings.
- "Show me the proof" email viewer.
- Background sync orchestrator polled by the dashboard.

**Tooling**
- `lighthouse setup`, `sync`, `serve`, `status`, `alerts`, `export`, `import-takeout`.
- `npm run seed:demo` for a no-credential dashboard preview.
- Unit tests (Vitest) for vault, parser, normalizer, currency math.
