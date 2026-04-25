# Loom / demo video — shot list and script

A 60-second Loom of the live dashboard is the single highest-leverage piece of
launch content. Embed the resulting MP4/GIF in:

- The README hero (replace the SVG with `assets/demo.gif`)
- Tweet 1 of your launch thread
- The Show HN first-comment

Below: a shot list (so you record once and don't redo it) and the voice-over
script (so you don't fumble live).

## Recording setup

- **Resolution**: 1440×900 viewport (matches the screenshots in the repo).
- **Theme**: macOS dark mode + Chrome dark theme. No tabs visible. Browser
  zoom 100%. Hide Chrome bookmarks bar.
- **Tool**: Loom (browser only, no audio narration recording — record with
  voice-over after via Loom's audio re-do or a CapCut overlay).
- **Frame rate**: 30 fps. The dashboard has Recharts animations that look
  much better at 30 fps than 60.
- **Cursor**: Loom's "highlight on click" is on. The cursor highlights when
  you point at things — that helps the eye follow.
- **Length**: aim for 60 seconds. People drop off at 75. **Hard cap at 90.**

## Pre-record checklist

```bash
# In one terminal, fresh seed + serve:
cd ~/Downloads/Projects/Lighthouse
rm -rf ~/.lighthouse
LIGHTHOUSE_HOME=~/.lighthouse-demo npm run setup       # passphrase: anything
npm run seed:demo
LIGHTHOUSE_PASSPHRASE=anything LIGHTHOUSE_HOME=~/.lighthouse-demo npm run serve
# In another, open dashboard:
open http://localhost:5174
```

## 8-shot list, 60 seconds total

| # | Time | Visual | What's happening |
|---|------|--------|------------------|
| 1 | 0:00–0:05 | Terminal: `git clone … && npm install && npm run seed:demo && npm run serve` | Establish: this is one command |
| 2 | 0:05–0:10 | Browser navigates to `localhost:5174` | The dashboard loads. Recharts animation plays. |
| 3 | 0:10–0:18 | Cursor traces across the four KPI cards | Show: $1,247.83 last 30 days, 11 active subs, $312.46/mo, 3 alerts |
| 4 | 0:18–0:28 | Click "Subscriptions" in the sidebar | Sortable table appears. Click any row to open the drawer. |
| 5 | 0:28–0:38 | Drawer opens with charge history + "show me the email" view | The proof email renders inline. |
| 6 | 0:38–0:46 | Click "Receipts" | Searchable table. Type "Amazon" in the filter box, results shrink. |
| 7 | 0:46–0:54 | Click "Alerts" | Three alert cards. Hover the trial-ending one. |
| 8 | 0:54–1:00 | Cut to terminal: `cat ~/.lighthouse/lighthouse.db | head` (or the file open in Finder) | One file. On your machine. The end. |

## 60-second voice-over (read at a calm pace, ~155 wpm)

> *(0:00)* This is Lighthouse — a self-hosted, open-source receipt and subscription tracker.
>
> *(0:05)* It runs entirely on your laptop. No bank credentials, no cloud, no servers.
>
> *(0:10)* It connects to Gmail read-only, runs every receipt through an LLM extractor, and gives you this.
>
> *(0:18)* You can see what you actually spent in the last 30 days, how many active subscriptions you have, and what your real monthly run rate is.
>
> *(0:28)* Click any subscription, and it shows you the source email — proof, not vibes.
>
> *(0:38)* Every receipt is searchable, with the line items the LLM pulled out of the email body.
>
> *(0:46)* And it surfaces the things you'd otherwise miss — trials about to convert, price increases, duplicate charges.
>
> *(0:54)* All of it lives in one SQLite file. On your computer. Five minutes to set up. MIT licensed.
>
> *(1:00)* GitHub link in the description.

## Common mistakes to avoid

- **Don't narrate every click.** Let the visuals carry the demo. The script above leaves long pauses where the cursor and animations do the talking.
- **Don't show your real receipts.** Use the demo seed. Your real data is your data.
- **Don't leave dev-tools open.** A console error visible in the corner of the recording will be the only thing people see.
- **Don't record on battery.** Loom drops frames when the laptop throttles.
- **Don't add background music.** The dashboard speaks for itself; music dates the recording within 6 months.

## After recording

1. Trim to under 60s.
2. Export as both MP4 (for Twitter/HN) and GIF (for the README hero).
3. For the GIF: use `ffmpeg` to keep it under 8 MB so GitHub renders it inline:
   ```bash
   ffmpeg -i demo.mp4 -vf "fps=15,scale=1200:-1:flags=lanczos" -loop 0 demo.gif
   ```
4. Save to `docs/preview/demo.gif` and replace the SVG hero in README.md with:
   ```markdown
   <img src="./docs/preview/demo.gif" alt="Lighthouse demo" width="100%" />
   ```
5. Commit with message: `chore: add demo GIF`

## Stretch: 30-second variant

If you can compress the same story to 30 seconds, post that version on Twitter
and the 60-second on HN. Twitter's autoplay window is ~3 seconds; people scroll
past anything that doesn't grab them in that window. Open the 30-second cut on
the spend chart already animating.
