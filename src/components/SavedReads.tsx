import Link from "next/link";
import { SAMPLE_WALLET } from "../../data/featured";
import { TokenMark } from "@/components/TokenMark";
import { SAVED_TRY_HEAD, SAVED_TRY_LINE, SAVED_WALLET } from "@/lib/copy";
import { listLiveSnapshot } from "@/lib/live-snapshot";

/** Saved reads to open when live checks are spent: real Nansen captures, no credits, no gate. */
export function SavedReads() {
  const tokens = listLiveSnapshot().slice(0, 8);
  return (
    <section className="mt-10 border-t border-[var(--line)] pt-8">
      <h2 className="section">{SAVED_TRY_HEAD}</h2>
      <p className="caption mt-2 max-w-md">{SAVED_TRY_LINE}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {tokens.map((token) => (
          <li key={`${token.chain}-${token.address}`}>
            <Link href={`/t/${token.chain}/${token.address}?saved=1`} className="try-chip">
              <TokenMark symbol={token.symbol} />
              <span className="text-[15px] font-medium">{token.symbol}</span>
              <span className="caption capitalize">{token.chain}</span>
              <i aria-hidden="true" className="ri-arrow-right-s-line text-[15px] text-[var(--faint)]" />
            </Link>
          </li>
        ))}
        {SAMPLE_WALLET ? (
          <li>
            <Link href={`/w/${SAMPLE_WALLET.kind}/${SAMPLE_WALLET.address}?saved=1`} className="try-chip">
              <i aria-hidden="true" className="ri-wallet-3-line text-[16px] text-[var(--muted)]" />
              <span className="text-[15px] font-medium">{SAVED_WALLET}</span>
              <i aria-hidden="true" className="ri-arrow-right-s-line text-[15px] text-[var(--faint)]" />
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** Whole hours until live checks come back at midnight UTC. */
export function hoursUntilReset(now = Date.now()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now) / 3_600_000));
}
