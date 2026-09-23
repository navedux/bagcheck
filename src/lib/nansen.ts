import "server-only";

import { env, type Env } from "./env";
import { MemoryCache, cacheKey, ttlMs } from "./cache";
import { Ledger } from "./ledger";
import {
  CREDITS,
  FLOW_PATH,
  HISTORICAL_PATH,
  SCREENER_PATH,
  TOKEN_INFO_PATH,
  WHO_BOUGHT_SOLD_PATH,
  errorEnvelopeSchema,
  flowRequestSchema,
  flowResponseSchema,
  flowsFromRow,
  historicalFlowsFromRow,
  historicalRequestSchema,
  historicalResponseSchema,
  isAllowedPath,
  isForbiddenPath,
  isTrustedNansenUrl,
  liveRequestBody,
  nansenRequestUrl,
  screenerRequestSchema,
  screenerResponseSchema,
  screenerTokensFromResponse,
  statsFromTokenInfo,
  tokenInfoRequestSchema,
  tokenInfoResponseSchema,
  tradersFromRows,
  whoBoughtSoldRequestSchema,
  whoBoughtSoldResponseSchema,
  type AllowedPath,
} from "./nansen-schema";
import type { Chain, CohortFlows, ScreenerToken, TokenStats, TraderPrint } from "./types";
import { isPartialCoverage } from "./window";

export type NansenError = {
  code:
    | "forbidden_endpoint"
    | "unregistered_endpoint"
    | "snapshot_only"
    | "budget_exhausted"
    | "account_blocked"
    | "auth"
    | "rate_limited"
    | "upstream"
    | "bad_request"
    | "schema_mismatch"
    | "timeout"
    | "not_found";
  path: string;
  status: number | null;
  retryAfter?: number;
};

export type CallResult<T> =
  | { ok: true; data: T; cacheHit: boolean }
  | { ok: false; error: NansenError };

export type NansenDeps = {
  fetch: typeof fetch;
  getEnv: () => Env;
  cache: MemoryCache;
  ledger: Ledger;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

const TIMEOUT_MS = 15_000;
const MISS_TTL_MS = 30 * 60_000;

/**
 * Day-granular ranges that closed before today never change, so they cache
 * for a day. Ranges that include today refresh hourly. Timestamp ranges
 * (the rolling 24h window) use the base who-bought-sold TTL.
 */
function rangeTtl(
  date: { from: string; to: string },
  now: number,
  ttl: ReturnType<typeof ttlMs>,
): number {
  if (date.to.includes("T")) return ttl.wbs;
  const today = new Date(now).toISOString().slice(0, 10);
  return date.to < today ? ttl.since : ttl.info;
}

function headerInt(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

export function createNansenClient(deps: NansenDeps) {
  let outboundStopped: NansenError["code"] | null = null;
  /** Identical calls already on the wire share one request and one charge. */
  const inflight = new Map<string, Promise<CallResult<unknown>>>();
  let usedToday = 0;
  let usedDay = "";

  function ttl() {
    return ttlMs(deps.getEnv().CACHE_TTL_SECONDS);
  }

  function dayKey(now: number): string {
    return new Date(now).toISOString().slice(0, 10);
  }

  function reserveCredit(now: number, credits: number): boolean {
    const day = dayKey(now);
    if (usedDay !== day) {
      usedDay = day;
      usedToday = 0;
    }
    if (usedToday + credits > deps.getEnv().DAILY_CALL_CAP) return false;
    usedToday += credits;
    return true;
  }

  function refund(credits: number): void {
    usedToday = Math.max(0, usedToday - credits);
  }

  async function call<T>(
    path: AllowedPath,
    body: unknown,
    parse: (json: unknown) => T,
    ttlMs: number,
  ): Promise<CallResult<T>> {
    if (isForbiddenPath(path)) {
      return { ok: false, error: { code: "forbidden_endpoint", path, status: null } };
    }
    if (!isAllowedPath(path)) {
      return { ok: false, error: { code: "unregistered_endpoint", path, status: null } };
    }

    const envNow = deps.getEnv();
    if (envNow.DATA_MODE !== "live" || !envNow.NANSEN_API_KEY) {
      await deps.ledger.append({
        path,
        timestamp: new Date(deps.now()).toISOString(),
        httpStatus: null,
        cacheHit: false,
        creditsQuoted: CREDITS[path],
        creditsUsed: 0,
        requestId: null,
        outcome: "snapshot_only",
      });
      return { ok: false, error: { code: "snapshot_only", path, status: null } };
    }

    const key = cacheKey({ path, body });
    const missKey = `miss:${key}`;
    const knownMiss = deps.cache.get<NansenError>(missKey, deps.now());
    if (knownMiss !== undefined) {
      return { ok: false, error: knownMiss };
    }
    const cached = deps.cache.get<T>(key, deps.now());
    if (cached !== undefined) {
      await deps.ledger.append({
        path,
        timestamp: new Date(deps.now()).toISOString(),
        httpStatus: 200,
        cacheHit: true,
        creditsQuoted: CREDITS[path],
        creditsUsed: 0,
        requestId: null,
        outcome: "ok",
      });
      return { ok: true, data: cached, cacheHit: true };
    }

    if (outboundStopped) {
      await deps.ledger.append({
        path,
        timestamp: new Date(deps.now()).toISOString(),
        httpStatus: null,
        cacheHit: false,
        creditsQuoted: CREDITS[path],
        creditsUsed: 0,
        requestId: null,
        outcome: outboundStopped,
      });
      return {
        ok: false,
        error: { code: outboundStopped, path, status: null },
      };
    }

    const pending = inflight.get(key);
    if (pending) return pending as Promise<CallResult<T>>;

    if (!reserveCredit(deps.now(), CREDITS[path])) {
      return { ok: false, error: { code: "budget_exhausted", path, status: null } };
    }

    const request = (async (): Promise<CallResult<T>> => {
      const result = await requestWithRetry(path, body, parse);
      if (result.ok) {
        deps.cache.set(key, result.data, ttlMs, deps.now());
      } else if (
        result.error.code === "not_found" ||
        result.error.code === "bad_request"
      ) {
        // A token Nansen does not know stays unknown for a while. Without
        // this, pasting junk addresses in a loop is a free way to burn credits.
        deps.cache.set(missKey, result.error, MISS_TTL_MS, deps.now());
      } else if (
        result.error.code === "timeout" ||
        result.error.code === "upstream" ||
        result.error.code === "schema_mismatch"
      ) {
        refund(CREDITS[path]);
      }
      return result;
    })();
    inflight.set(key, request as Promise<CallResult<unknown>>);
    try {
      return await request;
    } finally {
      inflight.delete(key);
    }
  }

  async function requestWithRetry<T>(
    path: AllowedPath,
    body: unknown,
    parse: (json: unknown) => T,
  ): Promise<CallResult<T>> {
    let last: CallResult<T> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      last = await requestOnce(path, body, parse);
      if (last.ok) return last;
      const { error } = last;
      if (error.code === "rate_limited" && attempt < 2) {
        await deps.sleep(Math.min((error.retryAfter ?? 1) * 1000, 2000));
        continue;
      }
      if (error.code === "upstream" && attempt === 0) {
        await deps.sleep(1000);
        continue;
      }
      if (error.code === "account_blocked" || error.code === "auth") {
        outboundStopped = error.code;
      }
      return last;
    }
    return last ?? {
      ok: false,
      error: { code: "upstream", path, status: null },
    };
  }

  async function requestOnce<T>(
    path: AllowedPath,
    body: unknown,
    parse: (json: unknown) => T,
  ): Promise<CallResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const url = nansenRequestUrl(deps.getEnv().NANSEN_BASE_URL, path);
    if (!isTrustedNansenUrl(url)) {
      return { ok: false, error: { code: "forbidden_endpoint", path, status: null } };
    }
    let status: number | null = null;
    let requestId: string | null = null;
    let creditsUsed: number | null = null;
    try {
      const response = await deps.fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: deps.getEnv().NANSEN_API_KEY ?? "",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      status = response.status;
      requestId = response.headers.get("x-request-id");
      creditsUsed = headerInt(response.headers, "x-nansen-credits-used");
      const retryAfter =
        headerInt(response.headers, "retry-after") ?? undefined;
      const json: unknown = await response.json().catch(() => ({}));

      if (response.status === 429) {
        await log(path, status, "rate_limited", creditsUsed, requestId);
        return {
          ok: false,
          error: { code: "rate_limited", path, status, retryAfter },
        };
      }
      if (response.status === 401) {
        await log(path, status, "auth", creditsUsed, requestId);
        return { ok: false, error: { code: "auth", path, status } };
      }
      if (response.status === 402 || response.status === 403) {
        await log(path, status, "account_blocked", creditsUsed, requestId);
        return { ok: false, error: { code: "account_blocked", path, status } };
      }
      if (response.status === 404) {
        await log(path, status, "not_found", creditsUsed, requestId);
        return { ok: false, error: { code: "not_found", path, status } };
      }
      if ([500, 502, 503, 504].includes(response.status)) {
        await log(path, status, "upstream", creditsUsed, requestId);
        return { ok: false, error: { code: "upstream", path, status, retryAfter } };
      }
      if (!response.ok) {
        const envelope = errorEnvelopeSchema.safeParse(json);
        const code = envelope.success ? envelope.data.code : undefined;
        if (
          code === "insufficient_credits" ||
          code === "plan_upgrade_required"
        ) {
          await log(path, status, "account_blocked", creditsUsed, requestId);
          return { ok: false, error: { code: "account_blocked", path, status } };
        }
        if (code === "unauthenticated") {
          await log(path, status, "auth", creditsUsed, requestId);
          return { ok: false, error: { code: "auth", path, status } };
        }
        if (code === "rate_limit_exceeded") {
          await log(path, status, "rate_limited", creditsUsed, requestId);
          return {
            ok: false,
            error: {
              code: "rate_limited",
              path,
              status,
              retryAfter: envelope.success ? envelope.data.retry_after : retryAfter,
            },
          };
        }
        if (code === "upstream_unavailable" || code === "query_timeout") {
          await log(path, status, "upstream", creditsUsed, requestId);
          return { ok: false, error: { code: "upstream", path, status, retryAfter } };
        }
        if (
          code === "unknown_field" ||
          code === "invalid_date_range" ||
          code === "missing_field"
        ) {
          await log(path, status, "bad_request", creditsUsed, requestId);
          return { ok: false, error: { code: "bad_request", path, status } };
        }
        await log(path, status, "upstream", creditsUsed, requestId);
        return { ok: false, error: { code: "upstream", path, status } };
      }

      try {
        const data = parse(json);
        await log(path, status, "ok", creditsUsed, requestId);
        return { ok: true, data, cacheHit: false };
      } catch {
        await log(path, status, "schema_mismatch", creditsUsed, requestId);
        return { ok: false, error: { code: "schema_mismatch", path, status } };
      }
    } catch (error) {
      const timeout = error instanceof Error && error.name === "AbortError";
      const outcome = timeout ? "timeout" : "upstream";
      await log(path, status, outcome, creditsUsed, requestId);
      return {
        ok: false,
        error: { code: timeout ? "timeout" : "upstream", path, status },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function log(
    path: string,
    httpStatus: number | null,
    outcome: string,
    creditsUsed: number | null,
    requestId: string | null,
  ): Promise<void> {
    await deps.ledger.append({
      path,
      timestamp: new Date(deps.now()).toISOString(),
      httpStatus,
      cacheHit: false,
      creditsQuoted: isAllowedPath(path) ? CREDITS[path] : 0,
      creditsUsed,
      requestId,
      outcome,
    });
  }

  return {
    async flowIntelligence(
      chain: Chain,
      address: string,
      timeframe: "1d" | "1h",
    ): Promise<CallResult<CohortFlows>> {
      const body = liveRequestBody(chain, address, timeframe);
      const parsed = flowRequestSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: "bad_request", path: FLOW_PATH, status: null },
        };
      }
      return call(
        FLOW_PATH,
        parsed.data,
        (json) => {
          const payload = flowResponseSchema.parse(json);
          return flowsFromRow(payload.data[0]);
        },
        timeframe === "1h" ? ttl().flows1h : ttl().flows1d,
      );
    },

    async tokenInformation(
      chain: Chain,
      address: string,
    ): Promise<CallResult<{ symbol: string | null; stats: TokenStats }>> {
      const body = liveRequestBody(chain, address, "1d");
      const parsed = tokenInfoRequestSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: "bad_request", path: TOKEN_INFO_PATH, status: null },
        };
      }
      return call(
        TOKEN_INFO_PATH,
        parsed.data,
        (json) => statsFromTokenInfo(tokenInfoResponseSchema.parse(json)),
        ttl().info,
      );
    },

    async whoBoughtSold(
      chain: Chain,
      address: string,
      side: "BUY" | "SELL",
      date: { from: string; to: string },
      perPage = 3,
    ): Promise<CallResult<TraderPrint[]>> {
      const field = side === "BUY" ? "bought_volume_usd" : "sold_volume_usd";
      const body = {
        chain,
        token_address: address,
        buy_or_sell: side,
        date,
        pagination: { page: 1, per_page: perPage },
        order_by: [{ field, direction: "DESC" as const }],
      };
      const parsed = whoBoughtSoldRequestSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: "bad_request", path: WHO_BOUGHT_SOLD_PATH, status: null },
        };
      }
      return call(
        WHO_BOUGHT_SOLD_PATH,
        parsed.data,
        (json) => tradersFromRows(whoBoughtSoldResponseSchema.parse(json).data, perPage),
        rangeTtl(date, deps.now(), ttl()),
      );
    },

    async tokenScreener(chains: Chain[]): Promise<CallResult<ScreenerToken[]>> {
      const body = {
        chains,
        timeframe: "24h" as const,
        filters: {
          include_stablecoins: false,
          include_native_tokens: false,
          volume: { min: 1_000_000 },
        },
        order_by: [{ field: "volume" as const, direction: "DESC" as const }],
        pagination: { page: 1, per_page: 25 },
      };
      const parsed = screenerRequestSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: "bad_request", path: SCREENER_PATH, status: null },
        };
      }
      return call(
        SCREENER_PATH,
        parsed.data,
        (json) => screenerTokensFromResponse(screenerResponseSchema.parse(json)),
        ttl().screener,
      );
    },

    async historicalFlowSummary(
      chain: Chain,
      address: string,
      dateRange: { from: string; to: string },
      entryDate: string,
    ): Promise<CallResult<CohortFlows>> {
      const body = {
        chain,
        token_address: address,
        date_range: dateRange,
      };
      const parsed = historicalRequestSchema.safeParse(body);
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: "bad_request", path: HISTORICAL_PATH, status: null },
        };
      }
      return call(
        HISTORICAL_PATH,
        parsed.data,
        (json) => {
          const payload = historicalResponseSchema.parse(json);
          return historicalFlowsFromRow(
            payload.data[0],
            isPartialCoverage(entryDate),
          );
        },
        ttl().since,
      );
    },
  };
}

const persistLedger =
  process.env.VERCEL == null && process.env.VITEST == null;

const defaultLedger = new Ledger(persistLedger);

export const nansen = createNansenClient({
  fetch,
  getEnv: () => env,
  cache: new MemoryCache(),
  ledger: defaultLedger,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
});

export const ledger = defaultLedger;
