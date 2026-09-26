import { z } from "zod";
import { sanitizeAddress, sanitizeSymbol } from "./sanitize";
import {
  CHAINS,
  type Chain,
  type CohortFlows,
  type Holding,
  type ScreenerToken,
  type TokenStats,
  type TraderPrint,
} from "./types";

export const FLOW_PATH = "tgm/flow-intelligence" as const;
export const TOKEN_INFO_PATH = "tgm/token-information" as const;
export const WHO_BOUGHT_SOLD_PATH = "tgm/who-bought-sold" as const;
export const HISTORICAL_PATH = "tgm/historical-token-flow-summary" as const;
export const SCREENER_PATH = "token-screener" as const;
/** Wallet balances. Allowed with attribution per the redistribution guide. */
export const BALANCE_PATH = "profiler/address/current-balance" as const;

export const ALLOWED_PATHS = [
  FLOW_PATH,
  TOKEN_INFO_PATH,
  WHO_BOUGHT_SOLD_PATH,
  HISTORICAL_PATH,
  SCREENER_PATH,
  BALANCE_PATH,
] as const;
export type AllowedPath = (typeof ALLOWED_PATHS)[number];

export const FORBIDDEN_PATH_PREFIXES = [
  "smart-money/",
  "profiler/address/labels",
  "tgm/pnl-leaderboard",
  "perp-leaderboard",
] as const;

export const CREDITS: Record<AllowedPath, number> = {
  [FLOW_PATH]: 1,
  [TOKEN_INFO_PATH]: 1,
  [WHO_BOUGHT_SOLD_PATH]: 1,
  [HISTORICAL_PATH]: 5,
  [SCREENER_PATH]: 1,
  [BALANCE_PATH]: 1,
};

export const flowTimeframeSchema = z.enum(["5m", "1h", "6h", "12h", "1d", "7d"]);

export const dateRangeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
  })
  .strict();

export const flowRequestSchema = z
  .object({
    chain: z.string().min(1),
    token_address: z.string().min(1),
    timeframe: flowTimeframeSchema,
  })
  .strict();

export const tokenInfoRequestSchema = z
  .object({
    chain: z.string().min(1),
    token_address: z.string().min(1),
    timeframe: flowTimeframeSchema,
  })
  .strict();

export const whoBoughtSoldRequestSchema = z
  .object({
    chain: z.string().min(1),
    token_address: z.string().min(1),
    buy_or_sell: z.enum(["BUY", "SELL"]),
    date: dateRangeSchema,
    pagination: z
      .object({
        page: z.number().int().min(1),
        // The API allows 1000; we cap at 50 (early-buyer pool reads).
        per_page: z.number().int().min(1).max(50),
      })
      .strict(),
    order_by: z
      .array(
        z
          .object({
            field: z.enum([
              "bought_volume_usd",
              "sold_volume_usd",
              "trade_volume_usd",
            ]),
            direction: z.enum(["ASC", "DESC"]),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();

export const historicalRequestSchema = z
  .object({
    chain: z.string().min(1),
    token_address: z.string().min(1),
    date_range: dateRangeSchema,
  })
  .strict();

const nullableNumber = z.number().nullable().optional();
const nullableInt = z.number().int().nullable().optional();
const nullableString = z.string().nullable().optional();

export const flowRowSchema = z
  .object({
    smart_trader_net_flow_usd: nullableNumber,
    whale_net_flow_usd: nullableNumber,
    public_figure_net_flow_usd: nullableNumber,
    exchange_net_flow_usd: nullableNumber,
    fresh_wallets_net_flow_usd: nullableNumber,
    top_pnl_net_flow_usd: nullableNumber,
  })
  .passthrough();

export const flowResponseSchema = z
  .object({
    data: z.array(flowRowSchema),
    warnings: z.array(z.string()).optional(),
  })
  .passthrough();

export const historicalRowSchema = flowRowSchema.extend({
  token_symbol: nullableString,
});

export const historicalResponseSchema = z
  .object({
    data: z.array(historicalRowSchema),
    warnings: z.array(z.string()).optional(),
  })
  .passthrough();

export const tokenInfoResponseSchema = z
  .object({
    data: z
      .object({
        name: nullableString,
        symbol: nullableString,
        token_details: z
          .object({
            token_deployment_date: nullableString,
            market_cap_usd: nullableNumber,
          })
          .passthrough()
          .nullable()
          .optional(),
        spot_metrics: z
          .object({
            volume_total_usd: nullableNumber,
            liquidity_usd: nullableNumber,
            total_holders: nullableInt,
          })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const whoBoughtSoldRowSchema = z
  .object({
    address: z.string(),
    bought_volume_usd: nullableNumber,
    sold_volume_usd: nullableNumber,
    trade_volume_usd: nullableNumber,
  })
  .passthrough();

export const whoBoughtSoldResponseSchema = z
  .object({
    data: z.array(whoBoughtSoldRowSchema),
  })
  .passthrough();

/**
 * Screener requests never pass trader_type, only_smart_money or any
 * smart-money label filter: those are label-gated and off-limits for us.
 */
export const screenerRequestSchema = z
  .object({
    chains: z.array(z.string().min(1)).min(1).max(5),
    timeframe: z.enum(["24h"]),
    filters: z
      .object({
        include_stablecoins: z.boolean(),
        include_native_tokens: z.boolean(),
        volume: z.object({ min: z.number().min(0) }).strict(),
      })
      .strict(),
    order_by: z
      .array(
        z
          .object({
            field: z.enum(["volume", "netflow"]),
            direction: z.enum(["ASC", "DESC"]),
          })
          .strict(),
      )
      .max(2),
    pagination: z
      .object({
        page: z.number().int().min(1),
        per_page: z.number().int().min(1).max(50),
      })
      .strict(),
  })
  .strict();

export const screenerRowSchema = z
  .object({
    chain: z.string(),
    token_address: z.string(),
    token_symbol: z.string(),
    volume: nullableNumber,
    netflow: nullableNumber,
    liquidity: nullableNumber,
    market_cap_usd: nullableNumber,
    token_age_days: nullableNumber,
  })
  .passthrough();

export const screenerResponseSchema = z
  .object({
    data: z.array(screenerRowSchema),
  })
  .passthrough();

export const errorEnvelopeSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
    status: z.number().optional(),
    request_id: z.string().nullable().optional(),
    retry_after: z.number().optional(),
  })
  .passthrough();

export function isAllowedPath(path: string): path is AllowedPath {
  return (ALLOWED_PATHS as readonly string[]).includes(path);
}

export function isForbiddenPath(path: string): boolean {
  return FORBIDDEN_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix),
  );
}

function num(value: number | null | undefined): number {
  return value ?? 0;
}

export function flowsFromRow(
  row: z.infer<typeof flowRowSchema> | undefined,
): CohortFlows {
  return {
    smartTraderNetFlowUsd: num(row?.smart_trader_net_flow_usd),
    whaleNetFlowUsd: num(row?.whale_net_flow_usd),
    publicFigureNetFlowUsd: row?.public_figure_net_flow_usd ?? null,
    exchangeNetFlowUsd: num(row?.exchange_net_flow_usd),
    freshWalletsNetFlowUsd: num(row?.fresh_wallets_net_flow_usd),
  };
}

/** NULL historical segments stay null: never coerced to zero. */
export function historicalFlowsFromRow(
  row: z.infer<typeof historicalRowSchema> | undefined,
  partialCoverage: boolean,
): CohortFlows {
  if (partialCoverage) {
    return {
      smartTraderNetFlowUsd: num(row?.smart_trader_net_flow_usd),
      whaleNetFlowUsd: 0,
      publicFigureNetFlowUsd: null,
      exchangeNetFlowUsd: 0,
      freshWalletsNetFlowUsd: num(row?.fresh_wallets_net_flow_usd),
    };
  }
  return flowsFromRow(row);
}

export function statsFromTokenInfo(
  payload: z.infer<typeof tokenInfoResponseSchema>,
): { symbol: string | null; stats: TokenStats } {
  const details = payload.data.token_details;
  const spot = payload.data.spot_metrics;
  return {
    symbol: payload.data.symbol ? sanitizeSymbol(payload.data.symbol) || null : null,
    stats: {
      volume24hUsd: spot?.volume_total_usd ?? null,
      marketCapUsd: details?.market_cap_usd ?? null,
      liquidityUsd: spot?.liquidity_usd ?? null,
      totalHolders: spot?.total_holders ?? null,
      tokenDeploymentDate: details?.token_deployment_date ?? null,
    },
  };
}

export function tradersFromRows(
  rows: z.infer<typeof whoBoughtSoldRowSchema>[],
  limit = 3,
): TraderPrint[] {
  return rows.slice(0, limit).map((row) => ({
    address: sanitizeAddress(row.address),
    boughtVolumeUsd: num(row.bought_volume_usd),
    soldVolumeUsd: num(row.sold_volume_usd),
  }));
}

export function screenerTokensFromResponse(
  payload: z.infer<typeof screenerResponseSchema>,
): ScreenerToken[] {
  const rows: ScreenerToken[] = [];
  for (const row of payload.data) {
    if (!CHAINS.includes(row.chain as Chain)) continue;
    rows.push({
      chain: row.chain as Chain,
      address: sanitizeAddress(row.token_address),
      symbol: sanitizeSymbol(row.token_symbol) || "TOKEN",
      volumeUsd: num(row.volume),
      netflowUsd: num(row.netflow),
      liquidityUsd: row.liquidity ?? null,
      marketCapUsd: row.market_cap_usd ?? null,
    });
  }
  return rows;
}

export function liveRequestBody(
  chain: Chain,
  tokenAddress: string,
  timeframe: z.infer<typeof flowTimeframeSchema>,
) {
  return {
    chain,
    token_address: tokenAddress,
    timeframe,
  };
}

export const NANSEN_HOST = "api.nansen.ai";

/** The API key may only be sent to Nansen's hostname over HTTPS. */
export function isTrustedNansenUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === NANSEN_HOST &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

export function nansenRequestUrl(baseUrl: string, path: AllowedPath): string {
  const base = baseUrl.replace(/\/$/, "");
  if (path === HISTORICAL_PATH) {
    const origin = base.replace(/\/api\/v1$/i, "");
    return `${origin}/api/v1beta1/${path}`;
  }
  return `${base}/${path}`;
}

/**
 * profiler/address/current-balance. Verified live Sep 25: rows carry chain,
 * token_address, token_symbol, token_name, token_amount, price_usd, value_usd,
 * sorted by value. No label fields. Native ETH is 0xeeee...eeee.
 */
export const balanceRequestSchema = z
  .object({
    address: z.string().min(1),
    chain: z.enum(["solana", "all"]),
    hide_spam_token: z.literal(true),
    pagination: z.object({ page: z.literal(1), per_page: z.number().int().min(1).max(50) }).strict(),
  })
  .strict();

export const balanceRowSchema = z
  .object({
    chain: z.string(),
    token_address: z.string().nullable().optional(),
    token_symbol: nullableString,
    token_amount: nullableNumber,
    price_usd: nullableNumber,
    value_usd: nullableNumber,
  })
  .passthrough();

export const balanceResponseSchema = z
  .object({
    data: z.array(balanceRowSchema),
  })
  .passthrough();

/** Native ETH has no contract; its flows are read through WETH on the same chain. */
export const NATIVE_EVM = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export const WRAPPED_NATIVE: Record<"ethereum" | "base", string> = {
  ethereum: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  base: "0x4200000000000000000000000000000000000006",
};

export function holdingsFromBalance(
  payload: z.infer<typeof balanceResponseSchema>,
): Holding[] {
  const rows: Holding[] = [];
  for (const row of payload.data) {
    if (!CHAINS.includes(row.chain as Chain)) continue;
    const chain = row.chain as Chain;
    const raw = (row.token_address ?? "").trim();
    if (!raw) continue;
    const native = chain !== "solana" && raw.toLowerCase() === NATIVE_EVM;
    const address = native ? WRAPPED_NATIVE[chain as "ethereum" | "base"] : raw;
    rows.push({
      chain,
      address: sanitizeAddress(chain === "solana" ? address : address.toLowerCase()),
      symbol: sanitizeSymbol(row.token_symbol ?? "") || "TOKEN",
      amount: num(row.token_amount),
      priceUsd: num(row.price_usd),
      valueUsd: num(row.value_usd),
      native,
    });
  }
  return rows;
}
