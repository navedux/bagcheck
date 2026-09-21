import type { CSSProperties } from "react";
import { VERDICT_TONE } from "@/lib/brand";
import { VERDICT_LABEL } from "@/lib/copy";
import type { VerdictDay } from "@/lib/types";

/** Thirty daily blocks, oldest to newest. A signal, not a chart. */
export function SignalStrip({
  history,
  size = "row",
  lit = true,
  stagger = 0,
}: {
  history: VerdictDay[];
  size?: "row" | "hero";
  lit?: boolean;
  stagger?: number;
}) {
  if (history.length === 0) {
    return (
      <span aria-hidden="true" className="caption">
        -
      </span>
    );
  }
  return (
    <span
      className={
        size === "hero"
          ? `strip strip-hero${lit ? " is-lit" : ""}`
          : "strip"
      }
      style={
        size === "hero"
          ? ({ "--n": history.length } as CSSProperties)
          : undefined
      }
      role="img"
      aria-label="Daily verdicts, last 30 days"
    >
      {history.map((day, index) => (
        <span
          key={day.day}
          className="strip-cell"
          style={
            {
              "--cell": VERDICT_TONE[day.verdict],
              "--cell-i": index,
              "--cell-stagger": `${stagger}ms`,
            } as CSSProperties
          }
          title={`${day.day} · ${VERDICT_LABEL[day.verdict]}`}
        />
      ))}
    </span>
  );
}
