# Hold Check

Paste a token. One word from 24h cohort flow: buy, hold, sell, don't buy, or wait.

Powered by [Nansen API](https://nansen.ai). Descriptive onchain data, not financial advice.

## Run without a key (judges)

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Leave `NANSEN_API_KEY` empty. `DATA_MODE=sim` is the default: a deterministic simulator seeded by token address, ninety days of cohort flows that advance daily. No Nansen call is made.

Open [http://localhost:3000](http://localhost:3000). Paste a token, or open WSOL / PEPE / BONK. You get one signal word for the last 24 hours. After you follow, home is paste first, then your list: current word, a 30-day verdict strip, and a badge when the read flipped since your last visit.

| Token | Chain | Chip |
| --- | --- | --- |
| USDC | ethereum `0xa0b8…eB48` | Quiet |
| WETH | ethereum `0xc02a…6Cc2` | Still bid |
| WSOL | solana `So11111111111111111111111111111111111111112` | Still bid |
| WBTC | ethereum `0x2260…c599` | Distribution |
| PEPE | ethereum `0x6982…1933` | Distribution |
| LINK | ethereum `0x5149…86CA` | Split |
| BONK | solana `DezX…B263` | Retail pump |
| JUP | solana `JUPy…DvCN` | Still bid |
| AERO | base `0x9401…8631` | Still bid |
| BRETT | base `0x532f…42e4` | Quiet |

Thin-floor fixture (not featured): ethereum `0x1111111111111111111111111111111111111111` → Too thin.

## Demo path (45s)

1. Home. "A buy, hold, or sell signal." Paste or open WSOL / PEPE / BONK. Attribution above the fold.
2. WSOL. Small chip Still bid. Loud line **Buy signal**. Why: traders and whales are still adding.
3. PEPE. Chip Distribution. Loud line **Don't buy signal**. Exchanges dominate the out column. Strip + stability.
4. PEPE date `2026-08-03`. Line becomes **Sell signal**. Holding since Aug 3.
5. Follow. Home → Your list. PEPE row shows **Sell signal** if the date is stored.

## Live path (local, after you add a key)

```bash
# .env.local
NANSEN_API_KEY=your-key
DATA_MODE=live
```

Restart `pnpm dev`. Any live error falls back to sim and marks the chip **stale**. Never create `NEXT_PUBLIC_NANSEN_*`.

## Scripts

```bash
pnpm test
pnpm typecheck
```

## What this is

One Next.js app. Math in `src/lib/verdict.ts`. Sentences in `src/lib/copy.ts`. Allowlisted Nansen POSTs only: `tgm/flow-intelligence`, `tgm/token-information`, `tgm/who-bought-sold`, `tgm/historical-token-flow-summary`, `token-screener` (no smart-money filters). No wallet. No generic proxy.
