import type { Chain } from "./types";

export function checkPath(chain: Chain, address: string, entryDate?: string): string {
  const path = `/t/${chain}/${address}`;
  return entryDate ? `${path}?entryDate=${entryDate}` : path;
}

export function truncateAddress(address: string): string {
  if (address.startsWith("0x") && address.length >= 10) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  if (address.length >= 8) {
    return `${address.slice(0, 4)}…${address.slice(-4)}`;
  }
  return address;
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

export function formatSignedUsd(value: number): string {
  if (value === 0) return formatUsd(0);
  const abs = formatUsd(Math.abs(value));
  return value > 0 ? `+${abs}` : `-${abs}`;
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

export function formatPctOfVol(normalized: number): string {
  const pct = normalized * 100;
  const abs = Math.abs(pct);
  const digits = abs >= 10 ? 0 : 1;
  const signed = `${pct > 0 ? "+" : pct < 0 ? "" : ""}${pct.toFixed(digits)}%`;
  return signed;
}
