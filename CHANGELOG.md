# Changelog

## 0.4.0 — design-system overhaul (April 2026)

A full pass through the dashboard for visual sophistication: tighter type
scale, warm-modern dark palette, sparklines on KPI cards, refined chart
tooltips, sortable table polish, smoother modal/drawer animations, proper
empty states with iconography, skeleton loaders for every async surface,
and a redesigned Settings page with sectioned cards.

**Design system**
- New palette: warm-modern dark with a coral primary (`#e58e5a`) and
  data-viz accents tuned for readability at small sizes (mint, gold,
  rose, azure, violet).
- Tightened type scale (2xs through 4xl) with proper line-heights.
- New utility classes: `lh-card`, `lh-card-elev`, `lh-btn-primary`,
  `lh-eyebrow`, `lh-pill-status-*`, `lh-skeleton`, `lh-num`.
- Tabular figures + Inter font features (`cv02 cv03 cv11 ss01 ss03`)
  applied globally for crisp number alignment.
- Page-level radial gradient background.

**Components**
- `KpiCard`: now renders a sparkline + delta-pct badge with semantic
  tone (red/green/flat) and "expense up = bad" inversion.
- `SpendChart`: custom tooltip card, average sub-stat in the header,
  k-formatted y-axis ticks, refined gradient fill, `activeDot` pulse.
- `TopMerchantsBar`: rank numbers, gradient bars, hover state.
- `MerchantBadge`: 10-color palette, optional ring outline, tighter
  typography.
- `AlertsList`: type-tinted cards, "All clear" empty state with icon,
  skeleton loader, headline + meta two-line layout.
- `EmailViewer`: refined header with eyebrow + truncate, smaller iframe
  toggle, smaller "Open in Gmail" button.
- `Modal`: Escape-to-close, body-scroll-lock, slide-up animation,
  optional footer slot.
- `Layout`: sidebar groups (Workspace / Watch / System), refined
  brand mark with halo, privacy footer card.

**Pages**
- `Overview`: inbox-health donut-bar redesign with colored markers,
  loading skeleton across all 4 KPI cards, "View all →" CTA on alerts.
- `Subscriptions`: tab pill polish, hover ChevronRight, drawer with
  proper slide-in-right animation and skeleton state.
- `Receipts`: refined search bar, confidence pill with a leading dot
  status indicator, modal upgrade with line-items card.
- `Alerts`: max-width tightened to 4xl for readability.
- `Settings`: redesigned into sectioned cards (Account, LLM provider,
  Sync, Danger zone). Real call-to-action with the primary coral
  button.

**Other**
- Sidebar version: 0.3.1 → 0.4.0.
- README badge color: gold → coral.

## 0.3.1 — vendor-neutral docs (April 2026)

Cleaned up vendor-specific naming in user-facing surfaces. The README,
ARCHITECTURE doc, CHANGELOG, launch playbooks, and demo data now talk about
"the LLM" / "your provider" rather than naming a specific vendor. Internal
code-level references (the SDK package name, env var names) are unchanged
because they're functional.

- Replaced `Anthropic` / `Claude Haiku 4.5` with vendor-neutral phrasing in
  README and ARCHITECTURE.
- Removed the "Credits" section's vendor thank-you.
- Re-rendered screenshots: demo merchant `Anthropic` (with plan `Claude Pro`)
  is now `Raycast` (Pro). The price-increase demo alert previously fired on
  `OpenAI` and now fires on `Linear`.
- Removed unused SVG mockups in `docs/preview/` (PNG screenshots are
  primary now).

## 0.3.0 — real screenshots + launch playbooks (April 2026)

**Real screenshots.** Replaced the hand-drawn SVG mockups in `docs/preview/`
with PNGs captured from the actual rendered React app. Built a tiny mock-API
harness so the dashboard could be rendered end-to-end (Playwright Chromium
headless, retina viewport) without needing the full SQLite stack.

**Tailwind / PostCSS fix.** While re-rendering, discovered that the v0.2.0
"absolute content paths" change actually broke Tailwind's content scan. Real
fix: use `path.join(dirname(fileURLToPath(import.meta.url)), …)` and pass the
config path explicitly to the PostCSS plugin so it doesn't depend on Vite's
cwd. CSS bundle now includes all utility classes (~20 KB vs the previous ~5
KB stub).

**Launch materials.** Added `docs/launch/` with paste-ready Show HN post,
Twitter threads (technical + visual), Loom shot list, and an
hour-by-hour launch-day operations checklist.

**Version visible in dashboard.** The sidebar `v0.1.0` was hardcoded; now
reads `v0.3.0`.

## 0.2.0 — bruteforce review pass (April 2026)

A self-imposed audit + polish pass: read every file with fresh eyes, ran the
schema against real SQLite, fixed every issue found, and added marketing-grade
visuals.

**Bug fixes**
- `dedupe.ts`: when a merchant had no domain, the cancellation lookup built a
  `LIKE '%null%'` pattern and could silently mark random subscriptions as
  cancelled. Now skipped when domain is unknown.
- `alerts.ts`: the duplicate-charge check was an unbounded N² self-join across
  the full receipts table. Capped at the last 90 days and added a date-range
  predicate to prune the join.
- `setup.ts`: the interactive setup prompted for the passphrase twice in the
  same run (once to verify, once to authorize Gmail). Now reuses the unlocked
  vault from step 1.
- `dev.ts`: silently hung when `LIGHTHOUSE_PASSPHRASE` was unset because tsx
  watch-restarts can't answer interactive prompts. Now exits with a clear hint.
- `vault.ts`: tightened parameter types in the rekey helper (TS strict mode
  caught implicit `any`).
- `tailwind.config.js`: content paths were resolved relative to whichever cwd
  Vite happened to launch from, occasionally producing a half-utility-set CSS.
  Switched to absolute paths via `import.meta.url`.

**README and visuals**
- Added a hero banner SVG, four faithful page-preview SVGs (overview,
  subscriptions, receipts, alerts), and shields.io badges for CI, license,
  version, stars, and "good first issue" count.
- Re-wrote cost and time estimates honestly (the v0.1 README was off by ~50×).
- Re-organized the README to lead with visuals and a "Why" pitch, then cost,
  then privacy.

**SQL contract tests**
- Added a Node-22 `node:sqlite` based validation that the schema applies, all
  ON CONFLICT clauses behave as advertised, and the partial unique index on
  `subscription_charges(receipt_id)` permits NULL duplicates.

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
- Cloud LLM by default; local Ollama supported via `LLM_PROVIDER=ollama`.
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
