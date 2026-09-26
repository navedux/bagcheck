"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChainMark } from "@/components/ChainMark";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DateField } from "@/components/DateField";
import { FlowWaterfall } from "@/components/FlowWaterfall";
import { PinButton } from "@/components/PinButton";
import { NetTraders } from "@/components/NetTraders";
import { ScoreMeters } from "@/components/ScoreMeters";
import { SinceLine } from "@/components/SinceLine";
import { StatStrip } from "@/components/StatStrip";
import { TokenMark } from "@/components/TokenMark";
import { TrackField } from "@/components/TrackField";
import { FlowMark, SignalHead, SignalWhy } from "@/components/VerdictChip";
import {
  COL_STRIP,
  SIGNAL_FORK_HINT,
  staleReason,
  WALLET_HELD_HINT,
  WINDOW_RAIL,
  clockLine,
  stabilityLine,
} from "@/lib/copy";
import { track } from "@/lib/analytics";
import { truncateAddress } from "@/lib/format";
import { bagSnapshot, parseBag, subscribeBag } from "@/lib/storage";
import type { CheckedToken } from "@/lib/types";
import { flipCount, runLengthDays, signalFor } from "@/lib/verdict";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * Read top-to-bottom. Each `at` value is ms after mount.
 *
 *    0ms   token line, the signal word, and the flow chip
 *   70ms   why, 24h clock, date
 *  140ms   score meters
 *  200ms   volume / liquidity
 *  260ms   30-day field
 *  310ms   net traders
 *  360ms   in / net / out parallel plot
 *
 * The claim lands first and alone; evidence follows fast enough that
 * nothing waits on decoration (all in by ~520ms).
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  claim: 0, // token + word
  why: 70, // why, clock, date
  meters: 140, // bid / retail / dist
  stats: 200, // volume and liquidity
  strip: 260, // 30-day field
  traders: 310, // buyers and sellers
  bridge: 360, // in / net / out plot
};

const STAGE = {
  claim: 1,
  why: 2,
  meters: 3,
  stats: 4,
  strip: 5,
  traders: 6,
  bridge: 7,
};

const BEAT = {
  fromY: 8, // px each beat rises from
  duration: 160, // matches design motion
};

const STRIP = {
  stagger: 14, // ms between hero cells
};

function CheckBeat({
  on,
  children,
  className,
}: {
  on: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`check-beat${on ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          "--beat-from": `${BEAT.fromY}px`,
          "--beat-ms": `${BEAT.duration}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function CheckClient({
  checked,
  entryDate,
  replayTrigger = 0,
}: {
  checked: CheckedToken;
  entryDate?: string;
  replayTrigger?: number;
}) {
  const raw = useSyncExternalStore(
    subscribeBag,
    () => bagSnapshot(checked.chain, checked.address),
    () => "",
  );
  const bag = parseBag(raw);
  const resolvedDate = entryDate ?? bag.entryDate;
  const thin = checked.verdict === "too-thin";
  // Stage is keyed to the run, so a new token (or replay) starts from zero
  // without resetting state inside the effect.
  const runKey = `${checked.chain}:${checked.address}:${replayTrigger}`;
  const [run, setRun] = useState({ key: runKey, stage: 0 });
  const stage = run.key === runKey ? run.stage : 0;

  // One token_checked per token shown. The saved bag is read directly, since
  // the first render still has the server's empty snapshot.
  const counted = useRef<string | null>(null);
  useEffect(() => {
    const key = `${checked.chain}:${checked.address}`;
    if (counted.current === key) return;
    counted.current = key;
    const saved = parseBag(bagSnapshot(checked.chain, checked.address));
    const holding =
      checked.verdict !== "too-thin" && (Boolean(entryDate ?? saved.entryDate) || saved.held === true);
    track("token_checked", {
      chain: checked.chain,
      symbol: checked.symbol,
      flow: checked.verdict,
      answer: signalFor(checked.verdict, holding),
      holding,
      data: checked.stale ? "saved" : "live",
      saved_reason: checked.savedWhy ?? null,
    });
  }, [checked, entryDate]);

  useEffect(() => {
    const timers: number[] = [];
    const steps = [
      TIMING.claim,
      TIMING.why,
      TIMING.meters,
      TIMING.stats,
      TIMING.strip,
      TIMING.traders,
      TIMING.bridge,
    ];
    for (const [index, at] of steps.entries()) {
      timers.push(window.setTimeout(() => setRun({ key: runKey, stage: index + 1 }), at));
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [runKey]);

  return (
    <div>
      <CheckBeat on={stage >= STAGE.claim}>
        <div className="flex items-center gap-2.5">
          <TokenMark symbol={checked.symbol} />
          <div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-medium tracking-[-0.01em]">
              {checked.symbol}
              <PinButton
                chain={checked.chain}
                address={checked.address}
                symbol={checked.symbol}
                source="check"
                labeled
              />
              <CopyLinkButton
                chain={checked.chain}
                address={checked.address}
                entryDate={thin ? undefined : resolvedDate}
              />
            </p>
            <p className="caption mt-0.5 flex flex-wrap items-center gap-1.5">
              <ChainMark chain={checked.chain} />
              <span className="capitalize">{checked.chain}</span>
              <span aria-hidden="true" className="text-[var(--faint)]">
                ·
              </span>
              <span className="font-mono" title={checked.address}>
                {truncateAddress(checked.address)}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SignalHead
            verdict={checked.verdict}
            held={!thin && bag.held === true}
            entryDate={thin ? undefined : resolvedDate}
          />
          {thin ? null : (
            <FlowMark verdict={checked.verdict} stale={checked.stale} savedWhy={checked.savedWhy} />
          )}
        </div>
      </CheckBeat>

      <CheckBeat on={stage >= STAGE.why} className="mt-5">
        {thin ? (
          <div>
            <SignalWhy verdict={checked.verdict} />
            {checked.stale ? <p className="caption mt-3">{staleReason(checked.savedWhy)}</p> : null}
          </div>
        ) : (
          <div>
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
              <div>
                <SignalWhy verdict={checked.verdict} />
                <p className="caption mt-3">{clockLine(resolvedDate)}</p>
                {resolvedDate ? <p className="caption mt-2">{WINDOW_RAIL}</p> : null}
                <div className="claim-move mt-4">
                  <DateField
                    chain={checked.chain}
                    address={checked.address}
                    urlEntryDate={entryDate}
                  />
                  {resolvedDate ? null : (
                    <p className="stance">{bag.held ? WALLET_HELD_HINT : SIGNAL_FORK_HINT}</p>
                  )}
                </div>
                {checked.since ? <SinceLine since={checked.since} /> : null}
                {checked.stale ? <p className="caption mt-3">{staleReason(checked.savedWhy)}</p> : null}
              </div>
              <ScoreMeters
                breakdown={checked.breakdown}
                lit={stage >= STAGE.meters}
              />
            </div>
          </div>
        )}
      </CheckBeat>

      {thin ? (
        <CheckBeat on={stage >= STAGE.stats} className="mt-8">
          <StatStrip stats={checked.stats} only="liq" />
        </CheckBeat>
      ) : (
        <CheckBeat on={stage >= STAGE.stats} className="mt-8">
          <StatStrip stats={checked.stats} />
        </CheckBeat>
      )}

      {!thin && checked.history.length > 0 ? (
        <CheckBeat on={stage >= STAGE.strip} className="mt-10">
          <section className="border-ticks border-t border-[var(--line)] pt-10">
            <p className="col">{COL_STRIP}</p>
            <div className="mt-4">
              <TrackField
                daily={checked.daily}
                history={checked.history}
                lit={stage >= STAGE.strip}
                stagger={STRIP.stagger}
              />
            </div>
            <p className="stance mt-3">
              {stabilityLine(
                runLengthDays(checked.history),
                flipCount(checked.history),
                checked.history.length,
              )}
            </p>
          </section>
        </CheckBeat>
      ) : null}

      {!thin ? (
        <CheckBeat on={stage >= STAGE.traders} className="mt-10">
          <NetTraders traders={checked.traders} verdict={checked.verdict} />
        </CheckBeat>
      ) : null}

      {!thin ? (
        <CheckBeat on={stage >= STAGE.bridge} className="mt-10">
          <FlowWaterfall
            flows={checked.flows1d}
            refUsd={checked.breakdown.ref}
            lit={stage >= STAGE.bridge}
          />
        </CheckBeat>
      ) : null}
    </div>
  );
}
