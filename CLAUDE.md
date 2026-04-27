# CLAUDE.md — orientation for AI coding sessions on this repo

This file is the first thing an AI agent should read when working on
Lighthouse. It captures the load-bearing constraints. Everything else
is in the README, ARCHITECTURE, and CHANGELOG.

## What this is

Lighthouse is a self-hosted Gmail receipt + subscription tracker. It
runs entirely on the user's laptop. The only outbound traffic is to
Gmail (read-only) and the configured LLM provider.

## Hard rules

- **Privacy first.** Never add code that POSTs anything outside the
  user's machine other than the two existing destinations (Gmail API,
  configured LLM). No telemetry, no analytics, no third-party scripts.
- **Local-only by default.** The API binds to `127.0.0.1`. Don't add
  `0.0.0.0` listeners or expose ports. The dashboard uses a same-host
  bearer-token discovery flow (`/api/__token__`); don't break that.
- **TypeScript strict.** No `any` without a comment explaining why.
- **Files under 300 lines.** Split components rather than letting them
  sprawl.
- **Money is integer cents.** No floats anywhere in the money path.
  Currency is an ISO 4217 string stored alongside the cents.
- **Every alert/insight path runs in the post-sync pipeline.** The
  invariant is: anything that fires alerts must be added to
  `runPostProcessing()` so it gets run on every sync.
- **Migrations are append-only.** Never edit
  `packages/core/src/db/migrations/0001_init.sql` etc. — bump to a new
  numbered file. The runner is idempotent and tracks applied versions
  in `schema_version`.
- **Run `npm run check` before pushing.** The pre-push git hook runs
  it automatically. Do not bypass with `--no-verify` unless the work
  is genuinely WIP.

## File map (top-level)

- `apps/cli/`               — Commander CLI entry point.
- `apps/web/`               — Vite + React + Tailwind dashboard.
- `packages/core/src/db/`   — SQLite schema + queries + migrations.
- `packages/core/src/gmail/` — OAuth + MIME parser + fetch loop.
- `packages/core/src/llm/`  — Anthropic + Ollama client + extractors.
- `packages/core/src/domain/` — Business logic: dedupe, alerts,
  budgets, goals, insights, webhooks, FX, notifications.
- `packages/core/src/pipeline/` — Concurrency-bounded orchestrator.
- `packages/core/src/api/`  — Fastify routes consumed by the SPA.
- `docs/`                   — ARCHITECTURE.md, launch playbooks,
  preview screenshots.

## Common workflows

| Goal | Command |
| --- | --- |
| First-run setup | `npm run setup` |
| Sync inbox + run extractors | `npm run sync` |
| Start API + dashboard | `npm run serve` |
| Try the dashboard with fake data | `npm run seed:demo && npm run serve` |
| Type / lint / test / build | `npm run check` |

## Open conventions

- Prefer small, single-purpose hooks over giant components.
- New API routes go in `packages/core/src/api/routes.ts`.
- New DB queries go in `packages/core/src/db/queries.ts` (or a sibling
  file if it grows past a few hundred lines).
- Skeleton loaders use the `lh-skeleton` utility class.
- Currency display uses `fmtMoney(cents, ccy)` from `lib/format.ts`.
- All numeric columns get `lh-num` so tabular figures align.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The fastest first PR is
adding a merchant rule to
`packages/core/src/domain/merchant_rules.ts`.

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).
