import { formatUsd } from "@/lib/format";
import type { TokenStats } from "@/lib/types";

const CELLS = [
  { key: "volume", label: "24h volume" },
  { key: "liq", label: "Liquidity" },
] as const;

function readStat(stats: TokenStats, key: (typeof CELLS)[number]["key"]): number | null {
  if (key === "volume") return stats.volume24hUsd;
  return stats.liquidityUsd && stats.liquidityUsd > 0 ? stats.liquidityUsd : null;
}

export function StatStrip({
  stats,
  only,
}: {
  stats: TokenStats;
  only?: (typeof CELLS)[number]["key"];
}) {
  const cells = only ? CELLS.filter((cell) => cell.key === only) : CELLS;
  return (
    <dl className={only ? "stat-strip is-one" : "stat-strip"}>
      {cells.map((cell) => {
        const value = readStat(stats, cell.key);
        return (
          <div key={cell.key}>
            <dt className="col">{cell.label}</dt>
            <dd className="num mt-1 text-[var(--ink)]">
              {value == null ? "-" : formatUsd(value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
