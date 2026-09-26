"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties } from "react";
import { ChainMark } from "@/components/ChainMark";
import { TokenMark } from "@/components/TokenMark";
import { VERDICT_TONE } from "@/lib/brand";
import {
  COL_SIGNAL,
  SIGNAL_LABEL,
  STALE_REASON,
  VERDICT_LABEL,
  WALLET_ADD_ALL,
  WALLET_ADDED_ALL,
  WALLET_ASSUME,
  WALLET_CHECK,
  WALLET_COL_VALUE,
  WALLET_EYEBROW,
  WALLET_FOOT,
  WALLET_NATIVE,
  walletAddedLine,
  walletSummary,
} from "@/lib/copy";
import { checkPath, formatCount, formatUsd, truncateAddress } from "@/lib/format";
import {
  addFollow,
  bagSnapshot,
  followSnapshot,
  parseBag,
  parseFollowing,
  saveBag,
  subscribeFollow,
} from "@/lib/storage";
import { flash } from "@/lib/toast";
import type { WalletRead } from "@/lib/types";
import { signalFor } from "@/lib/verdict";

export function WalletClient({ wallet }: { wallet: WalletRead }) {
  const followRaw = useSyncExternalStore(subscribeFollow, followSnapshot, () => "[]");
  const following = new Set(
    parseFollowing(followRaw).map((item) => `${item.chain}:${item.address}`),
  );
  const readable = wallet.rows.filter((row) => row.verdict !== null);
  const allIn = readable.length > 0 && readable.every((row) => following.has(`${row.chain}:${row.address}`));
  const summary = walletSummary(wallet.rows.slice(0, wallet.readCount).map((row) => row.verdict));

  function addAll() {
    let added = 0;
    for (const row of readable) {
      const result = addFollow({ chain: row.chain, address: row.address, symbol: row.symbol });
      if (result === "added" || result === "exists") {
        // It came from this wallet, so it is held: answers read as a holder.
        saveBag(row.chain, row.address, { ...parseBag(bagSnapshot(row.chain, row.address)), held: true });
      }
      if (result === "added") added += 1;
      if (result === "full") break;
    }
    flash(walletAddedLine(added));
  }

  return (
    <div>
      <p className="caption flex flex-wrap items-center gap-1.5">
        {WALLET_EYEBROW}
        <span aria-hidden="true" className="text-[var(--faint)]">·</span>
        <span className="font-mono" title={wallet.address}>
          {truncateAddress(wallet.address)}
        </span>
      </p>
      <h1 className="display mt-4 max-w-[20ch]">{summary}</h1>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="caption max-w-md">{WALLET_ASSUME}</p>
        {readable.length > 0 ? (
          <button type="button" className="btn-ghost" onClick={addAll} disabled={allIn}>
            {allIn ? WALLET_ADDED_ALL : WALLET_ADD_ALL}
          </button>
        ) : null}
      </div>
      {wallet.stale ? <p className="caption mt-3">{STALE_REASON}</p> : null}

      <section className="mt-10">
        <div className="row-head row-4 row-wallet">
          <p className="col">Token</p>
          <p className="col row-chain">Chain</p>
          <p className="col text-right">{WALLET_COL_VALUE}</p>
          <p className="col text-right">{COL_SIGNAL}</p>
        </div>
        <ul>
          {wallet.rows.map((row) => {
            const signal = row.verdict ? SIGNAL_LABEL[signalFor(row.verdict, true)] : null;
            return (
              <li key={`${row.chain}:${row.address}`} className="row-item">
                <Link href={checkPath(row.chain, row.address)} className="row-link row-4 row-wallet">
                  <span className="flex min-w-0 items-center gap-3">
                    <TokenMark symbol={row.symbol} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">{row.symbol}</span>
                      <span className="block truncate font-mono text-[12px] text-[var(--faint)]">
                        {row.native ? WALLET_NATIVE : `${formatCount(row.amount)} ${row.symbol}`}
                      </span>
                    </span>
                  </span>
                  <span className="row-chain caption flex items-center gap-1.5 capitalize">
                    <ChainMark chain={row.chain} />
                    {row.chain}
                  </span>
                  <span className="num text-right">{formatUsd(row.valueUsd)}</span>
                  <span className="text-right">
                    {row.verdict && signal ? (
                      <>
                        <span className="flex items-center justify-end gap-2 text-[13px] text-[var(--ink)]">
                          <span
                            aria-hidden="true"
                            className="sig-block"
                            style={{ "--sig": VERDICT_TONE[row.verdict] } as CSSProperties}
                          />
                          {signal}
                        </span>
                        <span className="caption mt-0.5 block">{VERDICT_LABEL[row.verdict]}</span>
                      </>
                    ) : (
                      <span className="caption text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4">
                        {WALLET_CHECK}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="caption mt-5 max-w-lg">{WALLET_FOOT}</p>
      </section>
    </div>
  );
}
