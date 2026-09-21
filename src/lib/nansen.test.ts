import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";
import type { Env } from "./env";
import { Ledger } from "./ledger";
import { createNansenClient } from "./nansen";

const liveEnv: Env = {
  DATA_MODE: "live",
  NANSEN_API_KEY: "test-key",
  NANSEN_BASE_URL: "https://api.nansen.ai/api/v1",
  CACHE_TTL_SECONDS: 120,
  RATE_LIMIT_PER_MIN: 30,
  DAILY_CALL_CAP: 800,
  ALLOWED_ORIGINS: "http://localhost:3000",
};

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function client(fetchImpl: typeof fetch, env: Env = liveEnv) {
  return createNansenClient({
    fetch: fetchImpl,
    getEnv: () => env,
    cache: new MemoryCache(),
    ledger: new Ledger(false),
    sleep: async () => undefined,
    now: () => Date.parse("2026-09-19T12:00:00.000Z"),
  });
}

const flowBody = {
  data: [
    {
      smart_trader_net_flow_usd: 50000,
      whale_net_flow_usd: 10000,
      public_figure_net_flow_usd: 0,
      exchange_net_flow_usd: 8000,
      fresh_wallets_net_flow_usd: 5000,
    },
  ],
};

describe("nansen client", () => {
  it("does not call out in snapshot mode", async () => {
    const fetchImpl = vi.fn();
    const api = client(fetchImpl, { ...liveEnv, DATA_MODE: "snapshot" });
    const result = await api.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("snapshot_only");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends apikey and caches a second call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, flowBody, {
        "x-nansen-credits-used": "1",
        "x-request-id": "req-1",
      }),
    );
    const api = client(fetchImpl);
    const first = await api.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    const second = await api.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    expect(first.ok && !first.cacheHit).toBe(true);
    expect(second.ok && second.cacheHit).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Record<string, string>).apikey).toBe("test-key");
  });

  it("retries 429 twice then fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, { code: "rate_limit_exceeded" }, { "retry-after": "1" }));
    const api = client(fetchImpl);
    const result = await api.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries a 500 once", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, flowBody));
    const api = client(fetchImpl);
    const result = await api.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops outbound calls after 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { code: "unauthenticated" }));
    const api = client(fetchImpl);
    await api.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    await api.tokenInformation(
      "solana",
      "So11111111111111111111111111111111111111112",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("posts who-bought-sold without label filters", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          {
            address: "0x1111111111111111111111111111111111111101",
            address_label: "Whale",
            bought_volume_usd: 10,
            sold_volume_usd: 0,
          },
        ],
      }),
    );
    const api = client(fetchImpl);
    const result = await api.whoBoughtSold(
      "ethereum",
      "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      "BUY",
      { from: "2026-09-18T12:00:00.000Z", to: "2026-09-19T12:00:00.000Z" },
    );
    expect(result.ok).toBe(true);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.filters).toBeUndefined();
    expect(body.buy_or_sell).toBe("BUY");
    expect(body.pagination).toEqual({ page: 1, per_page: 3 });
  });

  it("uses the beta URL for historical flow summary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ smart_trader_net_flow_usd: 1 }],
      }),
    );
    const api = client(fetchImpl);
    await api.historicalFlowSummary(
      "ethereum",
      "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      { from: "2026-08-03", to: "2026-09-19" },
      "2026-08-03",
    );
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      "https://api.nansen.ai/api/v1beta1/tgm/historical-token-flow-summary",
    );
  });

  it("does not send the API key to a non-Nansen host", async () => {
    const fetchImpl = vi.fn();
    const api = client(fetchImpl, {
      ...liveEnv,
      NANSEN_BASE_URL: "https://evil.example/api/v1",
    });
    const result = await api.flowIntelligence(
      "solana",
      "So11111111111111111111111111111111111111112",
      "1d",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden_endpoint");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
