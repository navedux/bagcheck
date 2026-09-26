# Bagcheck

**Who's buying your bag?** Paste a token and Bagcheck tells you, in a couple of words, what the wallets that matter did with it in the last 24 hours: **Looks good**, **Stay away**, **Wait**, **Hold**, or **Time to go**.

It answers one question: is anyone still buying, or are you the exit? It pulls smart traders, whales, new wallets, public figures, and exchanges from the Nansen API, sizes each against the token's own daily volume, and names what's happening: Still buying, Cashing out, Retail rush, Mixed, or Quiet. Tell it the day you bought and the same data answers for someone who already holds.

Live at [getbagcheck.vercel.app](https://getbagcheck.vercel.app). Powered by [Nansen API](https://nsn.ai/naved) (referral link). Descriptive onchain data, not financial advice. An independent project built for a Nansen buildathon, not an official Nansen product.

## Run it in under 5 minutes (no key)

Needs Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The default `DATA_MODE=snapshot` serves real Nansen reads for ten featured tokens, captured on 23 Sep 2026 (`data/snapshot/live.json`). No key and no Nansen calls.

Try:

1. Click **BONK**. Tag **Cashing out**, answer **Stay away**. Scroll: the biggest sellers, and exchanges on the out side of the money plot.
2. Pick a buy date. The answer becomes **Time to go**: same data, answered for a holder. (Live mode also re-reads everything since that day.)
3. **Add to bags**, then go home. Your bags keep the answer and the date on this device.
4. Click **WSOL** (Quiet, Wait) and **PEPE** (Retail rush, Wait) for the others.

5. Switch the paste field to **Wallet** and click **Try a sample wallet**: a real trader wallet, captured live. The headline reads "3 of your 5 biggest bags are cashing out", with an answer for each of the top 5 holdings. **Add all to bags** puts them on your list as held.

Pasting a token or wallet outside the saved set in snapshot mode shows "Not in this demo". Use live mode for anything.

## Live mode (any token)

```bash
# .env.local
NANSEN_API_KEY=your-key
DATA_MODE=live
```

Restart `pnpm dev`. A cold check makes 7 Nansen calls (12 credits with a buy date), then serves from cache for 15 minutes. If a live call fails, the page falls back to the saved read and marks the chip **stale**.

`DATA_MODE=sim` runs a local simulator with ninety days of history, for working on the UI without a key.

## How the read works

- **Data:** `tgm/flow-intelligence` (1d and 1h), `tgm/token-information`, `tgm/who-bought-sold`, and `tgm/historical-token-flow-summary` for the buy-date window. Wallets use `profiler/address/current-balance` (allowed with attribution). No smart-money endpoints, no labels.
- **Wallets:** one balance call (Ethereum and Base together, or Solana), then a two-call read (token info and 24h flows) for the 5 biggest non-stablecoin holdings. Native ETH is read through WETH. Rows 6 to 10 show an answer only if one is already cached; otherwise a Check link.
- **Score:** each cohort's net flow as a share of 24h volume. A move counts at 6% of a day's volume.
- **What's happening, first match wins:** Too small → Still buying → Cashing out → Retail rush → Mixed → Quiet. New-wallet flow above a full day of volume is treated as transfers, not buying.
- **The answer:** Still buying reads Looks good (thinking of buying) or Hold (already holding). Cashing out reads Stay away or Time to go. Everything else reads Wait, or Hold if you hold. It describes what wallets did; it's not financial advice.

All math is in [`src/lib/verdict.ts`](src/lib/verdict.ts), all sentences in [`src/lib/copy.ts`](src/lib/copy.ts). The full method is on the app's `/about` page.

## Credit guard

The key never reaches the browser, and a public live deploy cannot be used to drain it:

- Whole checks are cached per token and date. Identical in-flight checks and Nansen calls share one request.
- Unknown tokens are remembered for 30 minutes, so junk addresses cost once.
- New (uncached) tokens are capped per client per hour and per server per hour. Featured tokens skip the per-client cap. Past the cap you get the saved read or a busy page.
- A daily credit cap stops outbound calls. Connect Upstash Redis (Vercel KV) and it holds across every instance and restart, not just one: each call adds its credits to one shared daily total first, and is refused past the cap. If the store can't be reached, live calls are refused rather than risk spend.
- When today's credits are spent, pages say so plainly ("Out of live checks for today", with the time until midnight UTC) and offer saved reads. Saved reads (`?saved=1`) and the sample wallet never call Nansen.
- The catalog and board endpoints never call Nansen live.
- A cold wallet costs about 11 credits and one unit of the caller's hourly budget. The home list uses the same two-call read (2 credits, not 7), and reuses whatever a wallet already read.
- Unknown tokens stop after one call. Failed checks are cached briefly, so retries are free.
- Origin check, per-IP rate limit (the Vercel IP header is trusted only on Vercel), CSP, HSTS, frame blocking, and Zod on every input.
- No image proxy: logos load straight from Logo.dev, so `/_next/image` cannot spend your quota.

Tune with `CACHE_TTL_SECONDS`, `DAILY_CALL_CAP`, `COLD_CHECKS_PER_CLIENT_HOUR`, `COLD_CHECKS_PER_HOUR`, and `RATE_LIMIT_PER_MIN`. Without a KV store these are per instance. For one cap across all instances, add Upstash Redis from the Vercel Marketplace (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`); `DAILY_CALL_CAP` then applies globally, or set `GLOBAL_DAILY_CREDIT_CAP` to a different number. A Vercel Firewall rate-limit rule on `/t/*`, `/w/*`, and `/api/*` adds another layer.

## Deploy (Vercel)

Set `DATA_MODE=snapshot` for a zero-cost public demo. For a public live deploy, set `DATA_MODE=live`, `NANSEN_API_KEY`, `ALLOWED_ORIGINS=https://your-app.vercel.app`, and keep `DAILY_CALL_CAP` at a number of credits you can afford to lose in a day. Never create a `NEXT_PUBLIC_NANSEN_*` variable.

Analytics: Tracwell in private mode (no cookies, nothing stored in the browser), set up in `src/lib/analytics.ts`. It only runs on the public site, so local runs, previews, and forks send nothing, and Do Not Track or Global Privacy Control turns it off. Page views and events are skipped whenever the URL holds a wallet (`/w/`) or a buy date (`entryDate`), since Tracwell sends the page URL with each one. Events: `token_checked`, `buy_date_added`, `bag_added`, `wallet_check_started`. The public project key is in code; there are no analytics env variables.

Search: `src/lib/site.ts` holds the public URL that canonical links, the sitemap, `robots.txt`, and share cards use, so change `SITE_URL` there when you deploy somewhere else. `robots.txt` keeps crawlers off `/api/`, `/t/`, and `/w/`, since each check or wallet page can spend live credits; link previews (X, Slack, Discord) may still fetch a shared check. `public/llms.txt` describes the app for AI assistants, and a test keeps its numbers in step with `verdict.ts`.

## Scripts

```bash
pnpm test                   # unit tests
pnpm typecheck
pnpm lint
pnpm check-snapshot         # fails on prohibited endpoints or label fields in data/
pnpm refresh-live-snapshot  # recapture data/snapshot/live.json (key in .env.local, ~70 credits)
pnpm refresh-sample-wallet  # recapture data/snapshot/wallet.json (~11 credits)
pnpm export-ledger          # summarize your local call log (data/call-log.json)
pnpm warmup                 # one live check per featured token, local only
pnpm demo-check             # live answers for the featured tokens and sample wallet, warms the cache
```

## Layout

One Next.js 16 app. Server-only Nansen client in `src/lib/nansen.ts` with an allowlist of paths. Resolver, cache, and credit guard in `src/lib/resolve-check.ts` and `src/lib/cold-gate.ts`. No wallet connect, no generic proxy.
