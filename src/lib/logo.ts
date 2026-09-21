import { CHAIN_DOMAIN } from "./types";

/**
 * Logo.dev publishable key. Safe client-side by design: it ships inside
 * public image URLs, like a maps embed key. Never put a secret key here.
 */
const LOGO_DEV_PUBLISHABLE_KEY = "pk_EbCWLTsoS7q_4zm1nvofrw";
const LOGO_HOST = "img.logo.dev";
const DOMAIN_ALLOW = new Set(Object.values(CHAIN_DOMAIN));

function logoSize(size: number): number {
  if (!Number.isFinite(size)) return 28;
  return Math.min(128, Math.max(16, Math.round(size)));
}

function logoQuery(size: number): string {
  return `token=${LOGO_DEV_PUBLISHABLE_KEY}&size=${logoSize(size)}&format=png&theme=dark`;
}

const CRYPTO_ALIAS: Record<string, string> = {
  WSOL: "SOL",
  WETH: "ETH",
  WBTC: "BTC",
};

/**
 * Token logo by crypto symbol. Wrapped natives alias to the underlying
 * ticker (Logo.dev has SOL, not WSOL). Unknown symbols return a monogram.
 */
export function logoTicker(symbol: string): string {
  const clean = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
  return CRYPTO_ALIAS[clean.toUpperCase()] ?? clean;
}

export function logoUrl(symbol: string, size = 44): string {
  return `https://${LOGO_HOST}/crypto/${encodeURIComponent(logoTicker(symbol))}?${logoQuery(size)}`;
}

/**
 * Brand logo by domain: the most reliable lookup, used for chain marks
 * (chains have no unambiguous crypto symbol; "BASE" is an unrelated token).
 */
export function domainLogoUrl(domain: string, size = 28): string {
  const host = domain.trim().toLowerCase();
  if (!DOMAIN_ALLOW.has(host)) {
    return `https://${LOGO_HOST}/?${logoQuery(size)}`;
  }
  return `https://${LOGO_HOST}/${encodeURIComponent(host)}?${logoQuery(size)}`;
}
