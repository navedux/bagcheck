# Hold Check

Paste a token. Get one word from the last 24 hours of Nansen cohort flow: **Buy signal**, **Hold signal**, **Sell signal**, **Don't buy signal**, or **Wait**.

Hold Check asks one question: is capital still arriving, or are you the bid someone else is selling into? It reads smart traders, whales, fresh wallets, public figures, and exchanges from the Nansen API, weighs each against the token's own 24h volume, and names the flow state. Add the day you bought and the same read answers for a holder instead of a buyer.

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

1. Click **BONK**. Chip **Distribution**, word **Don't buy signal**. Scroll: biggest sellers, and exchanges on the out side of the flow plot.
2. Pick a buy date. The word becomes **Sell signal**: same read, answered for a holder. (Live mode also re-reads the flows over your holding window.)
3. **Add to list**, then go home. Your list keeps the word and the date on this device.
4. Click **WSOL** (Quiet, Wait) and **PEPE** (Retail pump, Wait) for the other states.

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
- **States, first match wins:** Too thin → Still bid → Distribution → Retail pump → Split → Quiet. Fresh-wallet flow above a full day of volume is treated as transfers, not buying.
- **Word:** Still bid reads Buy (looking) or Hold (holding). Distribution reads Don't buy or Sell. The rest read Wait, or Hold when you hold.

All math is in [`src/lib/verdict.ts`](src/lib/verdict.ts), all sentences in [`src/lib/copy.ts`](src/lib/copy.ts). The full method is on the app's `/about` page.

## Credit guard

The key never reaches the browser, and a public live deploy cannot be used to drain it:

- Whole checks are cached per token and date. Identical in-flight checks and Nansen calls share one request.
- Unknown tokens are remembered for 30 minutes, so junk addresses cost once.
- New (uncached) tokens are capped per client per hour and per server per hour. Featured tokens skip the per-client cap. Past the cap you get the saved read or a busy page.
- A daily credit cap stops outbound calls.
- The catalog and board endpoints never call Nansen live.
- Origin check, per-IP rate limit, CSP and frame blocking, and Zod on every input.

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
