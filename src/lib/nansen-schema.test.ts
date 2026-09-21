import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_PATH_PREFIXES,
  HISTORICAL_PATH,
  flowsFromRow,
  historicalFlowsFromRow,
  isAllowedPath,
  isForbiddenPath,
  isTrustedNansenUrl,
  nansenRequestUrl,
  tokenInfoResponseSchema,
  tradersFromRows,
  whoBoughtSoldRequestSchema,
  whoBoughtSoldResponseSchema,
} from "./nansen-schema";

describe("nansen schema", () => {
  it("allowlists only the four v1 endpoints", () => {
    expect(isAllowedPath("tgm/flow-intelligence")).toBe(true);
    expect(isAllowedPath("tgm/token-information")).toBe(true);
    expect(isAllowedPath("tgm/who-bought-sold")).toBe(true);
    expect(isAllowedPath("tgm/historical-token-flow-summary")).toBe(true);
    expect(isAllowedPath("tgm/token-screener")).toBe(false);
  });

  it("rejects prohibited prefixes", () => {
    expect(FORBIDDEN_PATH_PREFIXES.length).toBeGreaterThan(0);
    expect(isForbiddenPath("smart-money/holdings")).toBe(true);
    expect(isForbiddenPath("profiler/address/labels")).toBe(true);
    expect(isForbiddenPath("tgm/pnl-leaderboard")).toBe(true);
    expect(isForbiddenPath("perp-leaderboard")).toBe(true);
    expect(isForbiddenPath("tgm/flow-intelligence")).toBe(false);
  });

  it("sends historical calls to the beta base path", () => {
    expect(
      nansenRequestUrl("https://api.nansen.ai/api/v1", HISTORICAL_PATH),
    ).toBe(
      "https://api.nansen.ai/api/v1beta1/tgm/historical-token-flow-summary",
    );
  });

  it("trusts only https://api.nansen.ai", () => {
    expect(
      isTrustedNansenUrl("https://api.nansen.ai/api/v1/tgm/flow-intelligence"),
    ).toBe(true);
    expect(isTrustedNansenUrl("https://evil.example/api/v1/tgm/flow-intelligence")).toBe(
      false,
    );
    expect(isTrustedNansenUrl("http://api.nansen.ai/api/v1/tgm/flow-intelligence")).toBe(
      false,
    );
    expect(
      isTrustedNansenUrl("https://user:leak@api.nansen.ai/api/v1/tgm/flow-intelligence"),
    ).toBe(false);
  });

  it("treats null flow fields as zero on the 24h endpoint", () => {
    const flows = flowsFromRow({
      smart_trader_net_flow_usd: null,
      whale_net_flow_usd: undefined,
    });
    expect(flows.smartTraderNetFlowUsd).toBe(0);
    expect(flows.whaleNetFlowUsd).toBe(0);
  });

  it("does not invent zeros for uncovered historical segments", () => {
    const flows = historicalFlowsFromRow(
      {
        smart_trader_net_flow_usd: 12,
        whale_net_flow_usd: null,
        exchange_net_flow_usd: null,
        fresh_wallets_net_flow_usd: 3,
      },
      true,
    );
    expect(flows.smartTraderNetFlowUsd).toBe(12);
    expect(flows.whaleNetFlowUsd).toBe(0);
    expect(flows.publicFigureNetFlowUsd).toBeNull();
    expect(flows.exchangeNetFlowUsd).toBe(0);
  });

  it("never includes label filters on who-bought-sold", () => {
    const parsed = whoBoughtSoldRequestSchema.safeParse({
      chain: "ethereum",
      token_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      buy_or_sell: "BUY",
      date: { from: "2026-09-18T00:00:00Z", to: "2026-09-19T00:00:00Z" },
      pagination: { page: 1, per_page: 3 },
      order_by: [{ field: "bought_volume_usd", direction: "DESC" }],
      filters: { include_smart_money_labels: ["Whale"] },
    });
    expect(parsed.success).toBe(false);
  });

  it("drops address labels when mapping traders", () => {
    const payload = whoBoughtSoldResponseSchema.parse({
      data: [
        {
          address: "0x1111111111111111111111111111111111111101",
          address_label: "Whale",
          bought_volume_usd: 10,
          sold_volume_usd: 1,
        },
      ],
    });
    const traders = tradersFromRows(payload.data);
    expect(traders[0]).toEqual({
      address: "0x1111111111111111111111111111111111111101",
      boughtVolumeUsd: 10,
      soldVolumeUsd: 1,
    });
    expect(traders[0]).not.toHaveProperty("address_label");
  });

  it("reads token-information without treating social urls as data", () => {
    const parsed = tokenInfoResponseSchema.parse({
      data: {
        symbol: "PEPE",
        socials: { twitter: "https://x.com/pepecoineth" },
        token_details: { market_cap_usd: 1 },
        spot_metrics: { volume_total_usd: 2, liquidity_usd: 3 },
      },
    });
    expect(parsed.data.symbol).toBe("PEPE");
    expect("socials" in parsed.data).toBe(true);
  });
});
