import type { CSSProperties } from "react";
import { VERDICT_ICON, VERDICT_TONE } from "@/lib/brand";
import {
  SIGNAL_FORK_HINT,
  SIGNAL_LABEL,
  STALE_REASON,
  VERDICT_LABEL,
  reasonFor,
} from "@/lib/copy";
import type { Verdict } from "@/lib/types";
import { signalFor } from "@/lib/verdict";

export function FlowMark({
  verdict,
  stale,
}: {
  verdict: Verdict;
  stale?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <div
        className="flow-mark"
        style={{ "--sig": VERDICT_TONE[verdict] } as CSSProperties}
      >
        <i aria-hidden="true" className={`flow-mark-icon ${VERDICT_ICON[verdict]}`} />
        <span>{VERDICT_LABEL[verdict]}</span>
      </div>
      {stale ? (
        <span
          className="border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]"
          title={STALE_REASON}
        >
          stale
        </span>
      ) : null}
    </div>
  );
}

export function SignalHead({
  verdict,
  entryDate,
  held = false,
}: {
  verdict: Verdict;
  entryDate?: string;
  /** Came from the user's wallet: answer as a holder even without a date. */
  held?: boolean;
}) {
  const holding = Boolean(entryDate) || held;
  const signal = signalFor(verdict, holding);
  const muted = signal === "wait" || signal === "no-read";

  return (
    <h1 className={`display max-w-[20ch] ${muted ? "text-[var(--muted)]" : ""}`}>
      {SIGNAL_LABEL[signal]}
    </h1>
  );
}

export function SignalWhy({ verdict }: { verdict: Verdict }) {
  return <p className="max-w-[44ch] text-[15px] [text-wrap:pretty]">{reasonFor(verdict)}</p>;
}

export function VerdictChip({
  verdict,
  stale,
  entryDate,
}: {
  verdict: Verdict;
  stale?: boolean;
  entryDate?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SignalHead verdict={verdict} entryDate={entryDate} />
        <FlowMark verdict={verdict} stale={stale} />
      </div>
      <SignalWhy verdict={verdict} />
      {signalFor(verdict, Boolean(entryDate)) === "no-read" ? null : entryDate ? null : (
        <p className="stance">{SIGNAL_FORK_HINT}</p>
      )}
    </div>
  );
}
