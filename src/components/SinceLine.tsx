import { COL_SINCE, PARTIAL_COVERAGE_LINE } from "@/lib/copy";
import type { SinceRead } from "@/lib/types";

export function SinceLine({ since }: { since: SinceRead }) {
  return (
    <div className="since-block mt-5 max-w-[42ch]">
      <p className="col">{COL_SINCE}</p>
      <p className="since-line">{since.line}</p>
      {since.partialCoverage ? (
        <p className="caption mt-2">{PARTIAL_COVERAGE_LINE}</p>
      ) : null}
    </div>
  );
}
