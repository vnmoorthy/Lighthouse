# Launch day — operational checklist

A single page. Print it, tape it to the wall, run it from top to bottom on the
day you launch. Do not deviate. The order matters.

## T-minus 7 days

- [ ] Replace the demo-seed screenshots in `docs/preview/*.png` with screenshots
      from your real data, taken at retina 2× DPI.
- [ ] Record the Loom demo per [LOOM_SCRIPT.md](./LOOM_SCRIPT.md). Save MP4 +
      GIF to `docs/preview/`.
- [ ] Fix any CI red. Green CI badge on launch day is mandatory.
- [ ] Open 5 specific "good first issue" tickets — five different merchants
      that aren't yet in `merchant_rules.ts`. Examples: "merchant: Klaviyo",
      "merchant: Substack writers", "merchant: Squarespace". Specific issues
      convert to PRs at ~10× the rate of generic ones.
- [ ] Add a Discussions board: github.com/vnmoorthy/Lighthouse/discussions.
      Pin two threads: "Ideas / requested features" and "Merchants we don't
      yet recognize."

## T-minus 3 days

- [ ] Cross-link from any other project you've shipped (your blog, your
      portfolio). One inbound link from a reputable domain matters more than
      ten new tweets.
- [ ] Pre-warm: post one screenshot to Twitter without the URL, just as a
      "what I've been building" tease. People who reply now are people who
      will share on launch day.
- [ ] Run `npm run sync` on your real inbox once and capture the actual
      numbers (KPIs, receipt count, sub count). Real numbers beat round
      numbers for credibility.

## T-minus 24 hours

- [ ] Charge your phone. (You'll be replying to comments from it.)
- [ ] Plug in your laptop. Don't record on battery.
- [ ] Test the demo path on a fresh clone in a new terminal:
      `git clone … && npm install && npm run seed:demo && npm run serve`.
      Time it. If it's over 90 seconds, people will bounce.
- [ ] Tighten the README's first three lines. That's all anyone reads on
      first arrival. Make sure it answers: *what is this, who is it for, why
      should I keep reading.*
- [ ] Sleep early.

## Launch day — the hour-by-hour

| Time | Action |
| --- | --- |
| **T-1 hr** (~7am ET) | Final smoke test. `npm run sync` (if you use real data) so the dashboard is current when people land. Re-run typecheck + tests. |
| **T-15 min** | Tweet 1 of [TWITTER.md](./TWITTER.md), Thread A, **with overview.png attached**. Don't link the repo yet. |
| **T-0** (8am ET) | Submit Show HN per [SHOW_HN.md](./SHOW_HN.md). Do not edit the title after submitting. |
| **T+5 min** | Reply to your own Show HN with the technical first comment from SHOW_HN.md. This dramatically increases engagement. |
| **T+15 min** | Tweet 2 of Thread A. Quote-tweet your Show HN submission link. |
| **T+30 min** | Check HN rank. If you're on page 1, breathe. If not, post tweet 3 of Thread A and tag two friends who'd organically be excited. |
| **T+1 hr** | If you're holding ≥ #15 on HN, the launch is alive — answer comments calmly. If you're ≥ #25 by now, prep a "lessons learned" post for next week instead of refreshing endlessly. |
| **T+2 hr** | Rest of Thread A, spaced 20 min apart. Don't burn through them in a minute — Twitter rewards staggered posting. |
| **T+4 hr** | Cross-post to: r/selfhosted, r/privacy, lobste.rs (only if you have an invite), Hacker News tagged "Show HN" (already done). |
| **T+6 hr** | First debrief: copy the first 50 comments somewhere. Note what people misunderstood — that's the next week of README edits. |
| **T+8 hr** | Stop. Step away. Eat. The first 8 hours decide most of the outcome. The next 24 are about being present and gracious. |

## The 24-hour debrief

By bedtime on launch day, you'll know:

- **Stars added today.** Best signal. Anything ≥200 in 24h means the launch
  worked. Anything ≥1k means it landed hard.
- **Top inbound source.** Was it HN, Twitter, Reddit, or something else
  entirely? Use that to direct next week's energy.
- **Top question in comments.** Add a "FAQ" or "Common questions" section to
  the README the next morning. Each answer there saves you from re-typing it
  in 50 future comments.
- **Top bug filed.** Fix it that week. Public bug-fix velocity is the second
  best signal of project health, after stars.

## The 7-day plan

| Day | Focus |
| --- | --- |
| Day 0 | Launch. Be present. |
| Day 1 | First merchant-rule PR likely lands. Merge it within an hour. Reply to every issue. |
| Day 2 | Write a follow-up post: *"What I learned shipping Lighthouse to HN."* Honest about flop or hit. This post often does better than the launch post. |
| Day 3 | Add the top requested feature from comments to the roadmap section in the README. Acknowledge the requesters by name. |
| Day 4 | Quiet day. Triage backlog. |
| Day 5 | Cross-post the launch on a different forum (e.g., dev.to, your blog). |
| Day 6 | If stars ≥1k: open a "v0.3 wishlist" Discussion. Let users vote. |
| Day 7 | Write the first proper changelog entry post-launch. Tag v0.3.0. |

## The non-negotiables

1. **Don't ask for upvotes.** Anywhere. Ever. HN, Twitter, Reddit. Mods detect
   ring voting and bury you for it.
2. **Don't argue defensively in comments.** Concede when conceding is right.
   Thank people for catches. The audience is reading the comments more than
   they're reading the post.
3. **Don't post on Friday or Saturday.** It's not a hard rule, it's a fact.
   Weekday morning US East time is the launch window.
4. **Don't release v0.2.1 in the first 12 hours after launch.** A version bump
   on launch day reads as "still finding bugs." Wait until Day 1.
5. **Have fun.** A launch is a one-day event. The repo is the long game.
