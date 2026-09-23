import type { CSSProperties } from "react";
import { TRADERS_CAPTION, TRADERS_EMPTY_BUY, TRADERS_EMPTY_SELL, TRADERS_HEAD } from "@/lib/copy";
import { formatUsd, truncateAddress } from "@/lib/format";
import type { TraderPrint, TraderSides, Verdict } from "@/lib/types";

export function NetTraders({
  traders,
  verdict,
}: {
  traders: TraderSides;
  verdict: Verdict;
}) {
  if (verdict === "too-thin") return null;

  const peak = Math.max(
    ...traders.buyers.map((row) => row.boughtVolumeUsd),
    ...traders.sellers.map((row) => row.soldVolumeUsd),
    1,
  );

  return (
    <section className="border-ticks border-t border-[var(--line)] pt-10">
      <h2 className="section">{TRADERS_HEAD}</h2>
      <div className="mt-5 grid grid-cols-1 gap-10 sm:grid-cols-2">
        <Column title="Buyers" tone="in" rows={traders.buyers} field="bought" peak={peak} />
        <Column title="Sellers" tone="out" rows={traders.sellers} field="sold" peak={peak} />
      </div>
      <p className="caption mt-4 text-[12px] text-[var(--faint)]">{TRADERS_CAPTION}</p>
    </section>
  );
}

function Column({
  title,
  tone,
  rows,
  field,
  peak,
}: {
  title: string;
  tone: "in" | "out";
  rows: TraderPrint[];
  field: "bought" | "sold";
  peak: number;
}) {
  const color = tone === "in" ? "var(--in)" : "var(--out)";
  return (
    <div>
      <h3 className="section" style={{ color }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="caption mt-4">
          {field === "bought" ? TRADERS_EMPTY_BUY : TRADERS_EMPTY_SELL}
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const amount = field === "bought" ? row.boughtVolumeUsd : row.soldVolumeUsd;
            return (
              <li key={`${field}-${row.address}`} className="plot-row">
                <span className="font-mono text-[13px] text-[var(--muted)]">
                  {truncateAddress(row.address)}
                </span>
                <span className="meter-track" aria-hidden="true">
                  <span
                    className="meter-fill"
                    style={
                      {
                        width: `${(amount / peak) * 100}%`,
                        "--fill": color,
                      } as CSSProperties
                    }
                  />
                </span>
                <span className="num" style={{ color }}>
                  {formatUsd(amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
