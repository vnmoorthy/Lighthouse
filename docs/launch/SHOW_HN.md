# Show HN — paste-ready post

Hacker News rewards **plain title, plain body, real screenshots, no marketing voice**.
Below is a paste-ready submission. The "URL" field should point at the GitHub repo.

---

## Title (use one)

> **Show HN: Lighthouse – Self-hosted Gmail receipt and subscription tracker**

(`Show HN:` prefix is mandatory. Keep title under ~80 chars. The "self-hosted" + "Gmail" combo is what triggers the right pattern-match for the privacy crowd. Don't add "AI-powered" — HN is allergic to it in titles.)

## URL

> https://github.com/vnmoorthy/Lighthouse

## Text (post body — first comment by you)

> I built Lighthouse because I got tired of subscription trackers that wanted my bank credentials. They give Plaid full read access to my finances, and in exchange they tell me what I already half-knew — that "STRIPE *X-CO" is, somehow, a recurring charge.
>
> The data was always in my inbox. Receipts have line items. Subscription emails say "your $19 plan renews on May 14." But that's mostly text, not structure, and I'd been ignoring it because regex extraction is a tar pit.
>
> So this is the LLM-extractor version. It runs entirely on your machine: Gmail OAuth (read-only), an Anthropic Haiku call per email to classify and extract, then a SQLite database and a local React dashboard. Total wall time on a 25k-email inbox: ~90 minutes, ~$50 of API credit. Switch to Ollama and the API cost drops to zero.
>
> A few things I cared about while building it:
>
> - **No bank credentials, ever.** The threat model is: my laptop gets stolen, what happens? The Gmail refresh token is encrypted at rest with an argon2id-derived key from a passphrase I supply once.
> - **No "AI sprinkled on regex".** The classifier and extractors are entirely LLM-driven, with Zod-validated structured output. When the model gets it wrong, I improve the prompt instead of adding regex patches.
> - **Small enough to read in an afternoon.** ~6,600 LOC of TypeScript including tests. The pipeline is: classify → extract → normalize → dedupe → alert. Each step is a single file you can grep.
> - **Hand-curated merchant rules for the top ~70 merchants** ([packages/core/src/domain/merchant_rules.ts](https://github.com/vnmoorthy/Lighthouse/blob/main/packages/core/src/domain/merchant_rules.ts)) so common things like "AMZN Mktp US*1A2B3" → Amazon happen without an LLM call. Anything else falls through to the LLM and is cached. Adding a rule is a 3-line PR.
>
> The four alerts it surfaces (trial-ending, price increase, new subscription, duplicate charge) are the ones I personally kept missing. The "show me the email that proves this is recurring" view is the one I personally wanted.
>
> README has the architecture, screenshots, cost breakdown, and a 30-second `npm run seed:demo && npm run serve` for trying it without OAuth: https://github.com/vnmoorthy/Lighthouse
>
> Happy to answer questions about the LLM pipeline, the privacy model, or anything else.

---

## What to do *before* you submit

1. **Replace screenshots with retina-quality PNGs from your real inbox.** Mine are from the demo seed. Yours, with real merchant data, will land harder. Run `npm run seed:demo && npm run serve` (or your real data), screenshot at 2× DPI on a 1440×900 viewport, save to `docs/preview/{overview,subscriptions,receipts,alerts}.png`.
2. **Submit on a Tuesday or Wednesday morning, US Eastern time** (8–10 AM). Fridays are dead. Weekends are the absolute graveyard.
3. **Watch the front page rank in the first 60 minutes.** If it cracks page 1 by minute 60, it's launching. If it's stuck at #20+ on page 2 by then, submit a thoughtful, technical first comment to revive it.
4. **Don't ask people to upvote.** It violates HN guidelines and the mods will detect ring-voting and bury you. Tweet about it instead — that's how organic upvotes happen.
5. **Stay near your computer for 4 hours after submission** to answer questions. The first 20 comments determine whether the submission lives or dies. Don't be defensive; concede points; thank people for catches.

## After it lands

If the submission gets to ≥100 points:

1. Pin the GitHub Discussions board to "ideas / merchant rules wanted."
2. Make sure CI is green and the README has a green build badge — broken CI on launch day is the #1 thing that drops stars on a project that otherwise pops.
3. Add a "thank you" note to the README and tag merchants/contributors.
4. Open 5 specific "good first issue" issues for merchant rules. Specific issues convert visitors into contributors at ~10× the rate of "send a PR" prose.

## What to *not* say in comments

- Don't compare yourself to specific competitors by name. ("This is way better than X.") HN reads it as insecurity.
- Don't ever say "AI-powered" or "revolutionary." Both trigger immediate downvotes.
- Don't apologize for the project. ("It's just a side project, please be gentle.") Treat it like a thing you're proud of, because you should be.
