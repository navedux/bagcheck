"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { TRY_TOKENS } from "../../data/featured";
import { savedHref, useLivePaused } from "@/components/LivePaused";
import { TokenMark } from "@/components/TokenMark";
import { HOME_OR, WATCH_ADD, WATCH_HEAD, WATCH_LIST_EMPTY } from "@/lib/copy";
import { FOLLOW_LIMIT } from "@/lib/validate";

export function TryChips() {
  const paused = useLivePaused();
  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {TRY_TOKENS.map((token) => (
        <li key={`${token.chain}-${token.address}`}>
          <Link href={savedHref(`/t/${token.chain}/${token.address}`, paused)} className="try-chip">
            <TokenMark symbol={token.symbol} />
            <span className="text-[15px] font-medium">{token.symbol}</span>
            <span className="caption capitalize">{token.chain}</span>
            <i
              aria-hidden="true"
              className="ri-arrow-right-s-line text-[15px] text-[var(--faint)]"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Empty list: Your list chrome, then the three named starters. */
export function TryTokens({ onAdd }: { onAdd?: () => void }) {
  return (
    <section
      className="border-ticks border-t border-[var(--line)] pt-10"
      style={{ "--tick": "var(--p-cyan)" } as CSSProperties}
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
            0 / {FOLLOW_LIMIT}
          </p>
        </div>
      </div>
      <p className="caption pb-8">{WATCH_LIST_EMPTY}</p>
      <h3 className="section">{HOME_OR}</h3>
      <TryChips />
    </section>
  );
}
