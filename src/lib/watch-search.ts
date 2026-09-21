import { FEATURED } from "../../data/featured";
import { SIM_TOKENS } from "../../data/sim-tokens";
import { sanitizeSymbol } from "./sanitize";
import type { CatalogToken } from "./validate";
import { catalogTokenSchema, featuredOkSchema, normalizeAddress } from "./validate";

function tokenKey(token: { chain: string; address: string }): string {
  return `${token.chain}:${normalizeAddress(token.address)}`;
}

/** Featured mints with sim symbols. Used when /api/featured is down. */
export function staticCatalog(): CatalogToken[] {
  const symbols = new Map(
    SIM_TOKENS.filter((token) => !token.thin).map((token) => [
      `${token.chain}:${normalizeAddress(token.address)}`,
      token.symbol,
    ]),
  );
  return FEATURED.map((mint) => ({
    chain: mint.chain,
    address: normalizeAddress(mint.address),
    symbol: symbols.get(`${mint.chain}:${normalizeAddress(mint.address)}`) ?? "TOKEN",
    verdict: mint.expectedVerdict,
  }));
}

export function parseCatalog(json: unknown): CatalogToken[] {
  const envelope = featuredOkSchema.safeParse(json);
  if (envelope.success) {
    json = envelope.data;
  }
  if (!json || typeof json !== "object" || !("data" in json)) return [];
  const data = (json as { data: unknown }).data;
  if (!Array.isArray(data)) return [];
  const out: CatalogToken[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const parsed = catalogTokenSchema.safeParse(row);
    if (!parsed.success) continue;
    const token: CatalogToken = {
      chain: parsed.data.chain,
      address: normalizeAddress(parsed.data.address),
      symbol: sanitizeSymbol(parsed.data.symbol) || "TOKEN",
      verdict: parsed.data.verdict,
    };
    const key = tokenKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

export function mergeCatalog(
  base: CatalogToken[],
  live: CatalogToken[],
): CatalogToken[] {
  const map = new Map(base.map((token) => [tokenKey(token), token]));
  for (const token of live) {
    map.set(tokenKey(token), token);
  }
  return [...map.values()];
}

export function tokenMatches(
  query: string,
  token: Pick<CatalogToken, "symbol" | "chain" | "address">,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    token.symbol.toLowerCase().includes(needle) ||
    token.chain.toLowerCase().includes(needle) ||
    token.address.toLowerCase().includes(needle)
  );
}

export function filterCatalog(
  tokens: readonly CatalogToken[],
  query: string,
): CatalogToken[] {
  return tokens.filter((token) => tokenMatches(query, token));
}

export function catalogSymbol(
  tokens: readonly CatalogToken[],
  chain: CatalogToken["chain"],
  address: string,
): string {
  const key = `${chain}:${normalizeAddress(address)}`;
  return tokens.find((token) => tokenKey(token) === key)?.symbol ?? "TOKEN";
}
