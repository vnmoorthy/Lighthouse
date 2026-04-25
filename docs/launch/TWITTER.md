# Twitter / X launch — paste-ready threads

Two threads. One opinionated/technical (better for dev audiences), one
visual/concrete (better for general audiences). Pick one or post them on
different days.

---

## Thread A — the opinionated technical one

Best for: indie hackers, privacy folks, people who follow other open-source authors.
Post sequentially. Each ≤ 280 chars. Attach **the overview screenshot** to tweet 1.

> **Tweet 1** (with overview.png attached)
>
> I got tired of subscription trackers that want my bank credentials.
>
> So I built one that doesn't.
>
> Lighthouse reads your Gmail, extracts every receipt + subscription with an LLM, and runs entirely on your laptop.
>
> github.com/vnmoorthy/Lighthouse

> **Tweet 2** (reply, no image needed)
>
> The data was always in your inbox. Receipts have line items. Subscription emails say "your $19 plan renews May 14."
>
> Plaid trackers see "STRIPE *X-CO" and shrug. Your inbox sees "X Co — $19 — monthly."
>
> Inbox is better data. Bank credentials aren't worth giving up.

> **Tweet 3** (reply, attach subscriptions.png)
>
> What you get:
>
> 1. Every purchase, dedup'd, the last 24 months
> 2. Every active subscription with renewal dates + a "show me the email" button
> 3. Trial-ending alerts (so the free tool doesn't quietly become $9.99/mo)
>
> All offline. All MIT.

> **Tweet 4** (reply)
>
> Architecture is small enough to read in an afternoon — ~6,600 lines of TS:
>
> • SQLite + better-sqlite3
> • Argon2id-encrypted Gmail token
> • Cloud LLM for extraction (or local Ollama)
> • Fastify + React + Tailwind dashboard on localhost
>
> No cloud, no servers, no telemetry.

> **Tweet 5** (reply, attach alerts.png)
>
> Cost on a typical 25k-email inbox: ~$50 in cloud-LLM credit, one time. Re-syncing is essentially free thanks to a content-hash classifier cache.
>
> Or run Ollama locally and pay $0.

> **Tweet 6** (reply, the call to action)
>
> Try the demo without connecting Gmail:
>
> ```
> git clone https://github.com/vnmoorthy/Lighthouse
> npm install && npm run seed:demo && npm run serve
> ```
>
> 30 seconds to a working dashboard with 200 fake receipts.
>
> ⭐ if it's useful. PRs welcome — esp. merchant rules.

---

## Thread B — the visual one

Best for: general audience, people scrolling who don't want to read 6 tweets.
Post each as its own tweet (not a thread). Drop them across one day.

> **Tweet 1** (overview.png)
>
> Self-hosted, MIT-licensed alternative to Rocket Money / Truebill. Reads your Gmail (read-only), runs an LLM over every receipt, runs on your laptop only.
>
> 6,600 lines of code. github.com/vnmoorthy/Lighthouse

> **Tweet 2** (subscriptions.png)
>
> Every active subscription you have, dedup'd from years of monthly receipts. Per-month cost normalized so the $120 annual plan reads as $10/mo. Renewal dates included.

> **Tweet 3** (receipts.png)
>
> Searchable, filterable receipts — including the line items the LLM extracted from each email. Confidence score on every row, so you can spot-check the model.

> **Tweet 4** (alerts.png)
>
> The four alerts that catch the things you'd otherwise miss: trial converting in <7 days, price increases >5%, new subscriptions since last sync, duplicate charges within 24h.

---

## Do / don't

**Do:**
- Post the first tweet with a screenshot attached. Image-attached tweets get ~3× the engagement.
- @-mention any tools or libraries you genuinely depended on, but only sincerely.
- Reply to your own thread with the GitHub URL again 12 hours in — it boosts reach to a fresh timezone.
- Pin the launch tweet for at least a week.

**Don't:**
- Use marketing words ("revolutionary," "game-changing"). They trigger the cynicism reflex.
- Tag huge accounts to bait shares. They notice. Their followers notice.
- Post on Friday or Saturday. Tuesday/Wednesday morning is the sweet spot.

## After 24 hours

- Take screenshots of any nice replies and quote-RT them. Social proof compounds.
- If a thread is doing well (>50 likes on tweet 1), hold the second thread for a few days.
- If both threads underperform, that's data — write a "lessons from launching" follow-up post a week later. That post often does better than the original.
