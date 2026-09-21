import type { CSSProperties } from "react";
import { SCORE_MARK } from "@/lib/copy";
import { formatPctOfVol } from "@/lib/format";
import type { ScoreBreakdown } from "@/lib/types";
import { T } from "@/lib/verdict";

const TERMS = [
  { key: "bid", label: "Bid", pos: "var(--in)", neg: "var(--out)" },
  { key: "retail", label: "Retail", pos: "var(--p-yellow)", neg: "var(--faint)" },
  { key: "dist", label: "Dist", pos: "var(--out)", neg: "var(--in)" },
] as const;

export function ScoreMeters({
  breakdown,
  lit,
}: {
  breakdown: ScoreBreakdown;
  lit: boolean;
}) {
  const values = {
    bid: breakdown.bid,
    retail: breakdown.retail,
    dist: breakdown.dist,
  };
  const domain = Math.max(T, ...TERMS.map((term) => Math.abs(values[term.key])));
  const mark = `${(T / domain) * 100}%`;

  return (
    <div className={lit ? "meter-list is-lit" : "meter-list"} aria-label="24h score terms">
      {TERMS.map((term) => {
        const value = values[term.key];
        const width = `${(Math.abs(value) / domain) * 100}%`;
        const tone = value < 0 ? term.neg : term.pos;
        return (
          <div key={term.key} className="meter-row">
            <p className="col">{term.label}</p>
            <div className="meter-track" aria-hidden="true">
              <span
                className="meter-fill"
                style={
                  {
                    width,
                    "--fill": tone,
                  } as CSSProperties
                }
              />
              <span className="meter-mark" style={{ left: mark }} />
            </div>
            <p className="num text-right" style={{ color: tone }}>
              {formatPctOfVol(value)}
            </p>
          </div>
        );
      })}
      <p className="caption mt-1">{SCORE_MARK}</p>
    </div>
  );
}
