import Link from "next/link";
import type { CSSProperties } from "react";
import { TokenMark } from "@/components/TokenMark";
import { ChainMark } from "@/components/ChainMark";
import { VERDICT_TONE } from "@/lib/brand";
import {
  BOARD_CAPTION,
  BOARD_HEAD,
  COL_SHIFT,
  COL_SIGNAL,
  VERDICT_LABEL,
} from "@/lib/copy";
import { formatPctOfVol, truncateAddress } from "@/lib/format";
import { listBoard } from "@/lib/resolve-check";

export async function TodayBoard() {
  const rows = await listBoard();
  if (rows.length === 0) return null;

  return (
    <section
      className="border-ticks border-t border-[var(--line)] pt-10"
      style={{ "--tick": "var(--p-magenta)" } as CSSProperties}
    >
      <div className="flex items-baseline justify-between gap-4 pb-5">
        <h2 className="section">{BOARD_HEAD}</h2>
        <p className="col hidden sm:block">{BOARD_CAPTION}</p>
      </div>
      <div className="row-head row-board">
        <p className="col">Token</p>
        <p className="col row-chain">Chain</p>
        <p className="col">{COL_SIGNAL}</p>
        <p className="col text-right">{COL_SHIFT}</p>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={`${row.chain}-${row.address}`}>
            <Link
              href={`/t/${row.chain}/${row.address}`}
              className="row-link row-board"
            >
              <span className="flex min-w-0 items-center gap-3">
                <TokenMark symbol={row.symbol} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{row.symbol}</span>
                  <span className="block font-mono text-[12px] text-[var(--faint)]">
                    {truncateAddress(row.address)}
                  </span>
                </span>
              </span>
              <span className="row-chain caption flex items-center gap-1.5 capitalize">
                <ChainMark chain={row.chain} />
                {row.chain}
              </span>
              <span className="row-signal flex items-center gap-2 text-[13px] text-[var(--ink)]">
                <span
                  aria-hidden="true"
                  className="sig-block"
                  style={{ "--sig": VERDICT_TONE[row.verdict] } as CSSProperties}
                />
                <span className="hidden sm:inline">{VERDICT_LABEL[row.verdict]}</span>
              </span>
              <span
                className="num text-right"
                style={{ color: row.shift >= 0 ? "var(--in)" : "var(--out)" }}
              >
                {formatPctOfVol(row.shift)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
