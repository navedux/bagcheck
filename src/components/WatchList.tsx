"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChainMark } from "@/components/ChainMark";
import { PinButton } from "@/components/PinButton";
import { SignalStrip } from "@/components/SignalStrip";
import { TokenMark } from "@/components/TokenMark";
import { VERDICT_TONE } from "@/lib/brand";
import {
  COL_SIGNAL,
  COL_STRIP,
  SIGNAL_LABEL,
  WATCH_ADD,
  WATCH_HEAD,
  WATCH_ADD_RETRY,
  WATCH_LIST_FAIL,
  WATCH_READING,
  flipRecentLine,
  flipSinceVisitLine,
  watchStatus,
} from "@/lib/copy";
import { checkPath, formatUsd, truncateAddress } from "@/lib/format";
import { sanitizeSymbol } from "@/lib/sanitize";
import {
  bagSnapshot,
  followSnapshot,
  markSeen,
  parseBag,
  parseFollowing,
  parseSeen,
  seenSnapshot,
  subscribeBag,
  subscribeFollow,
} from "@/lib/storage";
import type { WatchRow } from "@/lib/types";
import { FOLLOW_LIMIT, normalizeAddress, watchOkSchema } from "@/lib/validate";
import { isHolding } from "@/lib/bag";
import { signalFor } from "@/lib/verdict";
import { flipBadge, type FlipBadge } from "@/lib/watch";

function subscribeWatch(onStoreChange: () => void): () => void {
  const offFollow = subscribeFollow(onStoreChange);
  const offBag = subscribeBag(onStoreChange);
  return () => {
    offFollow();
    offBag();
  };
}

function watchListSnapshot(): string {
  const follow = followSnapshot();
  const items = parseFollowing(follow);
  const bags = items
    .map((item) => `${item.chain}:${item.address}:${bagSnapshot(item.chain, item.address)}`)
    .join("|");
  return `${follow}::${bags}`;
}

type WatchState = {
  key: string;
  rows: WatchRow[];
  badges: Record<string, FlipBadge>;
};

const EMPTY_STATE: WatchState = { key: "", rows: [], badges: {} };

function rowKey(row: { chain: string; address: string }): string {
  return `${row.chain}:${row.address}`;
}

function badgeLine(badge: FlipBadge): string {
  return badge.kind === "since-visit"
    ? flipSinceVisitLine(badge.from)
    : flipRecentLine(badge.days);
}

function badgeRank(badge: FlipBadge | undefined): number {
  if (!badge) return 2;
  return badge.kind === "since-visit" ? 0 : 1;
}

export function WatchList({
  empty,
  onAdd,
  flush = false,
}: {
  empty: ReactNode;
  onAdd?: () => void;
  flush?: boolean;
}) {
  const raw = useSyncExternalStore(subscribeWatch, watchListSnapshot, () => "[]::");
  const items = parseFollowing(raw.split("::")[0] ?? "[]");
  const followKey = items.map((item) => rowKey(item)).join("|");
  const [state, setState] = useState<WatchState>(EMPTY_STATE);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    fetch("/api/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ chain: item.chain, address: item.address })),
      }),
    })
      .then((response) => response.json())
      .then((json: unknown) => {
        if (cancelled) return;
        const parsed = watchOkSchema.safeParse(json);
        const rows: WatchRow[] = parsed.success
          ? parsed.data.data.map((row) => ({
              ...row,
              address: normalizeAddress(row.address),
              symbol: sanitizeSymbol(row.symbol) || "TOKEN",
            }))
          : [];
        const seen = parseSeen(seenSnapshot());
        const now = new Date();
        const badges: Record<string, FlipBadge> = {};
        for (const row of rows) {
          const badge = flipBadge(row, seen, now);
          if (badge) badges[rowKey(row)] = badge;
        }
        setState({ key: followKey, rows, badges });
        setFailed(!parsed.success);
        markSeen(rows, Date.now());
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setState({ key: followKey, rows: [], badges: {} });
        }
      });
    return () => {
      cancelled = true;
    };
    // items are derived from followKey; refetch only when the list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followKey, reload]);

  if (items.length === 0) {
    return empty;
  }

  const loading = state.key !== followKey;
  const rowsByKey = new Map(state.rows.map((row) => [rowKey(row), row]));
  const ordered = loading
    ? []
    : items
        .map((item) => rowsByKey.get(rowKey(item)))
        .filter((row): row is WatchRow => row !== undefined)
        .sort((a, b) => badgeRank(state.badges[rowKey(a)]) - badgeRank(state.badges[rowKey(b)]));
  const missing = loading
    ? []
    : items.filter((item) => !rowsByKey.has(rowKey(item)));
  // Live reads carry no daily history; an empty column of dashes reads broken.
  const hasStrip = ordered.some((row) => row.history.length > 0);

  return (
    <section
      className={[
        flush ? "" : "border-ticks border-t border-[var(--line)] pt-10",
        hasStrip ? "" : "no-strip",
      ]
        .filter(Boolean)
        .join(" ") || undefined}
      style={flush ? undefined : ({ "--tick": "var(--p-cyan)" } as CSSProperties)}
    >
      <div className="flex items-center justify-between gap-4 pb-5">
        <h2 className="section">{WATCH_HEAD}</h2>
        <div className="flex items-center gap-3">
          {onAdd ? (
            <button type="button" className="btn-ghost" onClick={onAdd}>
              {WATCH_ADD}
            </button>
          ) : null}
          <p className="col">
            {items.length} / {FOLLOW_LIMIT}
          </p>
        </div>
      </div>
      {failed && !loading ? (
        <p className="caption pb-4">
          {WATCH_LIST_FAIL}{" "}
          <button type="button" className="sheet-text-btn" onClick={() => {
              setFailed(false);
              setReload((n) => n + 1);
            }}>
            {WATCH_ADD_RETRY}
          </button>
        </p>
      ) : null}
      <div className="row-head row-4">
        <p className="col">Token</p>
        <p className="col row-chain">Chain</p>
        <p className="col row-strip">{COL_STRIP}</p>
        <p className="col text-right">{COL_SIGNAL}</p>
      </div>
      <ul>
        {loading
          ? items.map((item) => (
              <li key={rowKey(item)} className="row-item">
                <span className="row-link row-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <TokenMark symbol={item.symbol} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">{item.symbol}</span>
                      <span className="block truncate font-mono text-[12px] text-[var(--faint)]">
                        {truncateAddress(item.address)}
                      </span>
                    </span>
                  </span>
                  <span className="row-chain caption flex items-center gap-1.5 capitalize">
                    <ChainMark chain={item.chain} />
                    {item.chain}
                  </span>
                  <span className="row-strip" />
                  <span className="text-right text-[13px] text-[var(--faint)]">
                    {WATCH_READING}
                  </span>
                </span>
                <span className="row-pin">
                  <PinButton chain={item.chain} address={item.address} symbol={item.symbol} />
                </span>
              </li>
            ))
          : null}
        {ordered.map((row) => {
          const badge = state.badges[rowKey(row)];
          const ticket = parseBag(bagSnapshot(row.chain, row.address));
          const signal = signalFor(row.verdict, isHolding(ticket));
          const status = watchStatus(ticket);
          return (
            <li key={rowKey(row)} className="row-item">
              <Link
                href={checkPath(row.chain, row.address, ticket.entryDate)}
                className="row-link row-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <TokenMark symbol={row.symbol} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{row.symbol}</span>
                    <span className="block truncate font-mono text-[12px] text-[var(--faint)]">
                      {truncateAddress(row.address)}
                      {row.volumeUsd ? ` · ${formatUsd(row.volumeUsd)}` : ""}
                    </span>
                  </span>
                </span>
                <span className="row-chain caption flex items-center gap-1.5 capitalize">
                  <ChainMark chain={row.chain} />
                  {row.chain}
                </span>
                <span className="row-strip">
                  <SignalStrip history={row.history} />
                </span>
                <span className="text-right">
                  <span className="flex items-center justify-end gap-2 text-[13px] text-[var(--ink)]">
                    <span
                      aria-hidden="true"
                      className="sig-block"
                      style={{ "--sig": VERDICT_TONE[row.verdict] } as CSSProperties}
                    />
                    {SIGNAL_LABEL[signal]}
                  </span>
                  <span className="caption mt-0.5 block">{status}</span>
                  {badge ? (
                    <span className="mt-0.5 flex items-center justify-end gap-1.5 text-[12px] text-[var(--ink)]">
                      <span
                        aria-hidden="true"
                        className="sig-block"
                        style={{ "--sig": "var(--p-yellow)" } as CSSProperties}
                      />
                      {badgeLine(badge)}
                    </span>
                  ) : null}
                </span>
              </Link>
              <span className="row-pin">
                <PinButton chain={row.chain} address={row.address} symbol={row.symbol} />
              </span>
            </li>
          );
        })}
        {missing.map((item) => (
          <li key={rowKey(item)} className="row-item">
            <Link href={checkPath(item.chain, item.address)} className="row-link row-4">
              <span className="flex min-w-0 items-center gap-3">
                <TokenMark symbol={item.symbol} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{item.symbol}</span>
                  <span className="block truncate font-mono text-[12px] text-[var(--faint)]">
                    {truncateAddress(item.address)}
                  </span>
                </span>
              </span>
              <span className="row-chain caption flex items-center gap-1.5 capitalize">
                <ChainMark chain={item.chain} />
                {item.chain}
              </span>
              <span className="row-strip">
                <SignalStrip history={[]} />
              </span>
              <span className="text-right">
                <span className="block text-[13px] text-[var(--faint)]">
                  {SIGNAL_LABEL["no-read"]}
                </span>
                <span className="caption mt-0.5 block">
                  {watchStatus(parseBag(bagSnapshot(item.chain, item.address)))}
                </span>
              </span>
            </Link>
            <span className="row-pin">
              <PinButton chain={item.chain} address={item.address} symbol={item.symbol} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
