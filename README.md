# Bagcheck

**Who's buying your bag?** Paste a token and Bagcheck tells you, in a couple of words, what the wallets that matter did with it in the last 24 hours: **Looks good**, **Stay away**, **Wait**, **Hold**, or **Time to go**.

It answers one question: is anyone still buying, or are you the exit? It pulls smart traders, whales, new wallets, public figures, and exchanges from the Nansen API, sizes each against the token's own daily volume, and names what's happening: Still buying, Cashing out, Retail rush, Mixed, or Quiet. Tell it the day you bought and the same data answers for someone who already holds.

Powered by [Nansen API](https://nansen.ai). Descriptive onchain data, not financial advice.

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

Pasting a token outside the featured set in snapshot mode shows "Not in this demo". Use live mode for any token.

## Live mode (any token)

```bash
# .env.local
NANSEN_API_KEY=your-key
DATA_MODE=live
```

Restart `pnpm dev`. A cold check makes 7 Nansen calls (12 credits with a buy date), then serves from cache for 15 minutes. If a live call fails, the page falls back to the saved read and marks the chip **stale**.

`DATA_MODE=sim` runs a local simulator with ninety days of history, for working on the UI without a key.

## How the read works

- **Data:** `tgm/flow-intelligence` (1d and 1h), `tgm/token-information`, `tgm/who-bought-sold`, and `tgm/historical-token-flow-summary` for the buy-date window. No smart-money endpoints, no labels.
- **Score:** each cohort's net flow as a share of 24h volume. A move counts at 6% of a day's volume.
- **What's happening, first match wins:** Too small → Still buying → Cashing out → Retail rush → Mixed → Quiet. New-wallet flow above a full day of volume is treated as transfers, not buying.
- **The answer:** Still buying reads Looks good (thinking of buying) or Hold (already holding). Cashing out reads Stay away or Time to go. Everything else reads Wait, or Hold if you hold. It describes what wallets did; it's not financial advice.

All math is in [`src/lib/verdict.ts`](src/lib/verdict.ts), all sentences in [`src/lib/copy.ts`](src/lib/copy.ts). The full method is on the app's `/about` page.

## Credit guard

The key never reaches the browser, and a public live deploy cannot be used to drain it:

- Whole checks are cached per token and date. Identical in-flight checks and Nansen calls share one request.
- Unknown tokens are remembered for 30 minutes, so junk addresses cost once.
- New (uncached) tokens are capped per client per hour and per server per hour. Featured tokens skip the per-client cap. Past the cap you get the saved read or a busy page.
- A daily credit cap stops outbound calls.
- The catalog and board endpoints never call Nansen live.
- Unknown tokens stop after one call. Failed checks are cached briefly, so retries are free.
- Origin check, per-IP rate limit (the Vercel IP header is trusted only on Vercel), CSP, HSTS, frame blocking, and Zod on every input.
- No image proxy: logos load straight from Logo.dev, so `/_next/image` cannot spend your quota.

Tune with `CACHE_TTL_SECONDS`, `DAILY_CALL_CAP`, `COLD_CHECKS_PER_CLIENT_HOUR`, `COLD_CHECKS_PER_HOUR`, and `RATE_LIMIT_PER_MIN`. The guards are in-memory per instance. For a hard cap across instances, add a Vercel Firewall rate-limit rule on `/t/*` and `/api/*`.

## Deploy (Vercel)

Set `DATA_MODE=snapshot` for a zero-cost public demo. For a public live deploy, set `DATA_MODE=live`, `NANSEN_API_KEY`, `ALLOWED_ORIGINS=https://your-app.vercel.app`, and keep `DAILY_CALL_CAP` at a number of credits you can afford to lose in a day. Never create a `NEXT_PUBLIC_NANSEN_*` variable.

## Scripts

```bash
pnpm test                   # unit tests
pnpm typecheck
pnpm lint
pnpm check-snapshot         # fails on prohibited endpoints or label fields in data/
pnpm refresh-live-snapshot  # recapture data/snapshot/live.json (key in .env.local, ~70 credits)
pnpm export-ledger          # summarize your local call log (data/call-log.json)
pnpm warmup                 # one live check per featured token, local only
```

## Layout

One Next.js 16 app. Server-only Nansen client in `src/lib/nansen.ts` with an allowlist of paths. Resolver, cache, and credit guard in `src/lib/resolve-check.ts` and `src/lib/cold-gate.ts`. No wallet connect, no generic proxy.
