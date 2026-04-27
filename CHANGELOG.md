# Changelog

## 0.42.0 — income, auto-recategorize, attachments (April 2026)

**v0.39 — Income tracking**
- New `income` table + `0009_income.sql`. Supports one-off and recurring
  income with cycle (weekly/biweekly/monthly/quarterly/annual).
- `db/income.ts`: `listIncome`, `createIncome`, `deleteIncome`, plus
  `getIncomeSummary()` returning trailing 30/90/365-day totals and
  monthly-recurring equivalent.
- `/api/income` GET/POST/DELETE + new `IncomeCard` widget in Settings.

**v0.40 — Auto-recategorize**
- New `pipeline/recategorize.ts`: re-runs the LLM categorizer on every
  merchant whose category is `'other'` or NULL, using merchant name +
  domain + a sample receipt. Conservative — only writes when the model
  reports ≥0.7 confidence and a non-other category.
- New `lighthouse recategorize` CLI command.
- Cheap (one short call per merchant, runs concurrently at LLM_CONCURRENCY).

**v0.41 — Receipt attachments**
- New `receipt_attachments` table + `0010_attachments.sql`.
- BLOB-stored bytes with a 5 MB hard cap.
- Endpoints: `GET /api/receipts/:id/attachments`, `POST` to upload,
  `GET /api/attachments/:id` to fetch (correct `Content-Type` and
  `Content-Disposition: inline` headers), `DELETE` to remove.

## 0.38.0 — investigator agent, goals, full-text search (April 2026)

**v0.35 — Investigator agent**
- New `llm/investigator.ts`: feeds the LLM a curated set of emails for a
  subscription (first-seen + last-seen + signup/trial/price-change emails
  matched by domain) and gets back a short markdown explanation: when did
  this start, was it a free trial, has the price changed, evidence of
  recent use.
- `POST /api/subscriptions/:id/investigate` endpoint.
- "Explain this charge" button in the Subscriptions drawer.

**v0.36 — Spending goals**
- New `goals` table + `0007_goals.sql` migration. Periods: weekly,
  monthly, annual, custom (date-range).
- `getGoalProgress()` computes used / cap / pct-of-window.
- `evaluateGoals()` fires alerts at ≥80% via the post-sync pipeline.
- `/api/goals` GET/POST/DELETE + new `GoalsList` widget in Settings.

**v0.37 — Full-text email body search (FTS5)**
- New `0008_fts.sql` migration: contentless `emails_fts` virtual table
  + insert/update/delete triggers to keep it in sync with `emails`.
- `searchEmailsFullText(q)` returns ranked hits with Bing-style snippets.
- `GET /api/search?q=…` endpoint.
- Command palette (⌘K) now searches inbox bodies when the query is ≥3
  chars, surfaced as an "In your inbox" group with snippet previews.

## 0.34.0 — month compare, multi-currency, exports, notes (April 2026)

**v0.30 — Side-by-side month compare**
- New `getMonthSlice(yyyy_mm)` query.
- New `/compare?a=2026-04&b=2026-03` page: hero KPIs with delta banner,
  category swing bars (biggest first), top-merchant table with Δ column.

**v0.31 — Multi-currency preference**
- New `domain/fx.ts` with a static rate table (~20 majors, override per-CCY
  via `LIGHTHOUSE_FX_<CCY>` env). Receipts stay in their native currency
  forever; the dashboard converts at render time.
- `/api/currency` GET/POST + `CurrencyPicker` widget in Settings.

**v0.32 — Multi-format export (YNAB / Lunch Money / Beancount)**
- New `apps/cli/src/commands/export_formats.ts` with renderers for YNAB
  CSV (Date / Payee / Memo / Outflow / Inflow), Lunch Money JSON, and
  Beancount plain-text transactions.
- \`npm run export -- --format ynab\` (or lunchmoney/beancount).

**v0.33 — Receipt notes + amount-range search**
- New `0006_receipt_notes.sql` migration: `user_note TEXT` on receipts.
- `setReceiptNote()` query + \`POST /api/receipts/:id/note\`.
- \`/api/receipts?min=&max=\` filters by ABS amount in dollars.

## 0.29.0 — year-end report, photo OCR, merchant management (April 2026)

**v0.26 — Year-end summary**
- New `getYearSummary(year)` query: totals, monthly bars, top 10 merchants,
  category breakdown, biggest day/month, active subs at year end.
- New `/year/:year` page (`YearSummaryPage`) with year-back/year-forward
  navigation. Print-stylesheet aware: ⌘P → clean one-page PDF.

**v0.27 — Receipt photo OCR**
- New `extractReceiptFromImage()` using Anthropic vision input. Same
  `ReceiptExtraction` shape as the email extractor.
- New `pipeline/ingest_photo.ts` writes the image-derived receipt to a
  synthetic email row (so the dashboard's "show me the proof" view still
  works) plus a regular receipt row.
- `POST /api/ingest/photo` accepts `{ image_base64, media_type }`.
- Drag-and-drop `PhotoUpload` widget in Settings.

**v0.28 — Bulk edit + merchant management**
- New queries: `setMerchantCategory`, `setMerchantDisplayName`,
  `mergeMerchants`, `bulkSetReceiptMerchant`.
- New routes: `PATCH /api/merchants/:id`, `POST /api/merchants/:id/merge`,
  `POST /api/receipts/bulk-merchant`.
- New `/merchants` index page with edit + merge modals.
- Receipts table gains a checkbox column + a `BulkBar` that appears when
  any rows are selected, with a single "reassign to merchant" action.

## 0.25.0 — onboarding, money-flow, forwarded email, native notifications (April 2026)

**v0.22 — Onboarding wizard + privacy report**
- New `OnboardingWizard` modal that auto-shows for first-time users (zero
  receipts in DB, not previously dismissed). Three steps: intro, connect
  Gmail, run first sync. Persisted dismissal in localStorage.
- New `/privacy` page: a deliberately blunt rundown of every piece of data
  Lighthouse stores, every external call, every place a secret lives.

**v0.23 — Money-flow visualisation**
- New `MoneyFlowSankey` component: custom SVG ribbon chart from category →
  top merchants. Computed entirely from existing `/api/summary` data.

**v0.24 — Forwarded-email ingest (non-Gmail support)**
- New `pipeline/ingest_forwarded.ts`: synchronous classify + extract for a
  single email payload. POSTed to `/api/ingest/email` it accepts
  `{ from, subject, body_text, body_html, internal_date }` and runs the
  same classifier + receipt/subscription extractors as bulk sync.
- Use cases: Outlook / Yahoo / iCloud users with a "forward to webhook"
  rule, or Apple Shortcuts piping a single message in.

**v0.25 — Native OS notifications**
- New `domain/notifications.ts`. macOS toast via `osascript -e 'display
  notification …'`; Linux via `notify-send`. Windows is a no-op.
- Disabled by default. Toggle in Settings via `NotificationsToggle`.
- Hooked into `insertAlert()` so every fresh alert gets a system toast
  in addition to the webhook + dashboard.

## 0.21.0 — patterns, multi-account, webhooks (April 2026)

**v0.19 — Spending patterns**
- New `getSpendingPatterns()` query: receipts grouped by day-of-week
  and hour-of-day over the last 365 days.
- `SpendingPatterns` component on Overview: 7-bar weekday chart +
  24-cell hour heat strip, both highlighting the peak bucket.

**v0.20 — Multi-account foundation**
- New `accounts` table + `0005_multi_account.sql` migration. Existing
  installs get a default "Personal" account seeded from current kv
  values; emails/receipts gain an `account_id` column defaulting to 1.
- `db/accounts.ts` ships listAccounts / getDefaultAccount / createAccount.
- `/api/accounts` + `AccountsCard` widget in Settings.

**v0.21 — Webhooks**
- New `domain/webhooks.ts`. Configure one URL in Settings. Every alert
  POSTs a stable JSON payload: `{ type, alert_type, subject_table,
  subject_id, payload, created_at, source, version }`. Fire-and-forget
  with a 5s timeout. Failures are logged but never block sync.
- `WebhookCard` in Settings with Save + Send-test buttons.

## 0.18.0 — tags, budgets, iCal feed, weekly digest (April 2026)

**v0.15 — Tags**
- New `receipt_tags` table + `0003_tags.sql` migration. Free-text tags
  with normalize-on-write (lowercase + kebab-case + 32-char cap).
- Tag CRUD via `/api/receipts/:id/tags` and `/api/tags`.
- Tag filter on `/api/receipts?tag=…`.

**v0.16 — Budgets per category**
- New `budgets` table + `0004_budgets.sql` migration.
- `getBudgetProgress()` computes used / cap / pace ratio against the
  current calendar month.
- `BudgetsDisplay` widget on Overview shows progress bars with a
  pace-marker line for "% of month elapsed".
- `BudgetsEdit` widget in Settings: create / list / delete budgets.
- `evaluateBudgets()` fires alerts at ≥80% of cap, in the post-sync pass.

**v0.17 — iCal feed + weekly digest CLI**
- `/api/calendar/<token>.ics` serves a VCALENDAR feed of every active
  subscription's next renewal date. All-day events with a 1-day VALARM.
  Token-in-URL because calendar clients don't send Authorization.
- `/api/calendar-url` returns the ready-to-paste URL.
- `npm run digest` (or `lighthouse digest --days 30 --json`) prints a
  markdown summary suitable for cron-emailing-yourself or piping into a
  weekly status doc. Includes spend totals, top merchants, trial
  warnings, forgotten subs, and insight cards.

## 0.14.0 — heatmap, insights, custom alerts (April 2026)

**v0.11 — Calendar heatmap on /merchants/:id**
- New `CalendarHeatmap` component: 53-week × 7-day grid in the GitHub
  contribution-graph style, tinted by amount spent that day. Hover for
  date + amount + count.

**v0.12 — Insight cards (smart anomaly detection)**
- New `domain/insights.ts` engine produces 4 kinds of "did you notice…?"
  cards from existing data: category MoM swings, first-time merchants,
  4-month upward streaks, and big single-day spend.
- Inline `InsightsRow` on Overview, hidden when nothing's worth showing.

**v0.13 — Custom alerts (user-defined rules)**
- New `custom_alert_rules` table + idempotent `0002_custom_alerts.sql`
  migration that widens the `alerts.type` check.
- Three rule types: `merchant_threshold`, `category_threshold`,
  `any_charge`.
- `CustomAlertsCard` widget in Settings with create form + rule list.
- `evaluateCustomRules()` runs at the end of every sync via the
  pipeline post-processing pass. 30-day suppression matches built-in
  alerts.

## 0.10.0 — six-iteration feature push (April 2026)

A single push containing six significant feature additions, each pulled from
something a competitor product (Rocket Money, Bobby, Truebill, Copilot,
Cushion) does well and that Lighthouse was missing.

**v0.5 — Categories everywhere**
- New `getCategoryBreakdown` and `getYearOverYear` queries on the API.
- Donut chart on Overview with hover-to-isolate and click-to-filter.
- Category dropdown filter on Receipts.
- A clean 15-category taxonomy mirroring `merchant_rules.ts`.

**v0.6 — Cancellation deep-links + Subscription Health**
- Hand-curated `CANCEL_LINKS` for ~50 top merchants (Netflix, Spotify, Apple,
  GitHub, Notion, NYTimes, AT&T, …). Each subscription drawer now exposes a
  one-click "Open cancel page" button when a link is known.
- Subscription Health panel on /subscriptions: monthly run rate, top 3 most
  expensive, "possibly forgotten" subs (active but no charge in >1.5x cycle).

**v0.7 — Command palette (⌘K)**
- New global `CommandPalette` reachable via ⌘K. Searches across pages,
  categories, merchants, subscriptions, receipts. Keyboard nav (↑/↓/↵/esc).
  Sidebar shows the keyboard shortcut.

**v0.8 — Year-over-Year + per-merchant timeline**
- YoY card on Overview: 12-month rolling spend split into "this year" vs
  "last year" bars, with a 12-month change percentage.
- New /merchants/:id page: hero KPIs (total spent, count, avg/month, most
  recent), monthly bar chart, full receipt list. Clicking a merchant name
  on the Receipts table jumps here.

**v0.9 — Mobile + theme toggle + trial banner**
- Sidebar collapses behind a hamburger on screens narrower than `lg`. Slide-in
  drawer with backdrop. Auto-closes on route change.
- Theme toggle in Settings (System / Dark / Light). Persisted to localStorage,
  bootstrap-applied before first paint.
- Persistent amber trial banner across the top when any active trial is
  ending in ≤14 days.

**v0.10 — Refund detection + tax CSV + printable receipts**
- New `refund` classifier bucket. Refund emails create a receipt with a
  *negative* amount so totals net out cleanly.
- `npm run export -- --tax-only` filters the receipts CSV to a hand-picked
  list of business-deductible categories (developer, cloud, productivity,
  utilities, travel, transit, apps).
- Receipt modal now has a "Print / Save as PDF" button. Uses a print
  stylesheet that hides the dashboard chrome and renders a clean,
  accountant-friendly receipt at print time.

**Other**
- Sidebar version: 0.4.0 → 0.10.0.
- README badge color & version bumped.

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
