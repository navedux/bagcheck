import type { CSSProperties } from "react";

/**
 * The brand atom as hero art: a quiet panel, an accumulation run, a
 * distribution flip, a retail blip, and today lit. The product story told
 * in blocks: density kept low on purpose.
 */
const CELLS: Array<{ tone?: string; bright?: boolean }> = [
  {},
  {},
  {},
  { tone: "var(--p-cyan)" },
  { tone: "var(--p-cyan)" },
  { tone: "var(--p-cyan)" },
  {},
  {},
  { tone: "var(--p-magenta)" },
  { tone: "var(--p-magenta)" },
  {},
  {},
  {},
  { tone: "var(--p-yellow)" },
  {},
  {},
  { tone: "var(--p-cyan)", bright: true },
];

export function BrandStrip() {
  return (
    <div aria-hidden="true" className="brand-strip">
      {CELLS.map((cell, index) => (
        <span
          key={index}
          className="brand-cell"
          style={
            {
              ...(cell.tone ? { "--cell": cell.tone } : {}),
              "--cell-o": cell.tone ? (cell.bright ? 1 : 0.35) : 1,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
