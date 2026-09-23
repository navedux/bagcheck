import type { CSSProperties, ReactNode } from "react";
import { VERDICT_TONE } from "@/lib/brand";
import { SIGNAL_LABEL, VERDICT_COPY, VERDICT_LABEL } from "@/lib/copy";
import type { Verdict } from "@/lib/types";
import {
  EARLY_WINDOW_DAYS,
  LIQUIDITY_FLOOR_USD,
  RECENT_SELL_WINDOW_DAYS,
  T,
  T_QUIET,
  VOLUME_FLOOR_USD,
  signalFor,
} from "@/lib/verdict";
import { LABEL_COVERAGE_START, MAX_HOLD_DAYS } from "@/lib/window";

const STATES: Verdict[] = ["still-bid", "distribution", "retail-pump", "split", "quiet", "too-thin"];

const pct = (value: number) => `${Math.round(value * 100)}%`;
const usd = (value: number) => `$${value.toLocaleString("en-US")}`;

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6">
      <p className="col">About</p>
      <h1 className="display mt-4 max-w-[18ch]">
        Is capital still arriving, or are you the exit?
      </h1>
      <p className="mt-5 max-w-[56ch] text-[15px] leading-[1.6] text-[var(--muted)]">
        Hold Check reads one token at a time. It asks Nansen who moved the token
        in the last 24 hours, weighs each group against the token&apos;s own
        volume, and answers with one word.
      </p>

      <div className="mt-12">
        <AboutRow title="Data">
          Every check reads the Nansen API: flow intelligence (24h and last hour),
          token information, and who bought and sold. A buy date adds the
          historical flow summary. Results are cached, so a repeat check costs
          no new calls.
        </AboutRow>

        <AboutRow title="Cohorts">
          Smart traders, whales, fresh wallets, public figures, and exchanges.
          Each cohort&apos;s net flow is divided by 24h volume, so a major and a
          memecoin are judged by relative pressure, not raw dollars. A move
          counts at {pct(T)} of a day&apos;s volume; under {pct(T_QUIET)} is quiet.
          Fresh-wallet flow bigger than a whole day of volume is treated as
          transfers, not buying. Exchange deposits are checked before retail.
        </AboutRow>

        <AboutRow title="States">
          <span className="block">
            Six flow states. The chip names the state; the loud word depends on
            whether you already hold the token.
          </span>
          <span className="about-states mt-5" role="table" aria-label="Flow states and signals">
            <span className="about-state is-head" role="row">
              <span className="col" role="columnheader">State</span>
              <span className="col" role="columnheader">Looking</span>
              <span className="col" role="columnheader">Holding</span>
            </span>
            {STATES.map((verdict) => (
              <span key={verdict} className="about-state" role="row">
                <span role="cell">
                  <span className="flex items-center gap-2 text-[var(--ink)]">
                    <span
                      aria-hidden="true"
                      className="sig-block"
                      style={{ "--sig": VERDICT_TONE[verdict] } as CSSProperties}
                    />
                    {VERDICT_LABEL[verdict]}
                  </span>
                  <span className="caption mt-1 block">{VERDICT_COPY[verdict]}</span>
                </span>
                <span role="cell">{SIGNAL_LABEL[signalFor(verdict, false)]}</span>
                <span role="cell">{SIGNAL_LABEL[signalFor(verdict, true)]}</span>
              </span>
            ))}
          </span>
        </AboutRow>

        <AboutRow title="Buy date">
          Add the day you bought and the same flows are re-read over your holding
          window (up to {MAX_HOLD_DAYS} days), next to the 24h read. The date is
          stored on your device and in the link you copy, nowhere else.
        </AboutRow>

        <AboutRow title="Early exit">
          Under the traders panel: how many of the top sellers of the last{" "}
          {RECENT_SELL_WINDOW_DAYS} days were among the biggest buyers in the
          token&apos;s first {EARLY_WINDOW_DAYS} days. Addresses only, never labels.
        </AboutRow>

        <AboutRow title="Limits">
          Solana, Ethereum, and Base. Tokens under {usd(LIQUIDITY_FLOOR_USD)}{" "}
          liquidity or {usd(VOLUME_FLOOR_USD)} daily volume are too thin to read.
          Who bought and sold covers DEX trades only. Whale, public figure, and
          exchange labels in historical flows start on {LABEL_COVERAGE_START}.
          This is descriptive onchain data, not financial advice.
        </AboutRow>

        <AboutRow title="Modes">
          The footer says which mode is running. Live calls Nansen. Snapshot
          serves saved Nansen reads for the featured tokens. Sim is a local
          simulator for running the app without a key.
        </AboutRow>
      </div>
    </main>
  );
}

function AboutRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-2 border-t border-[var(--line)] py-7 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-10">
      <h2 className="section pt-0.5">{title}</h2>
      <div className="max-w-[60ch] text-[15px] leading-[1.6]">{children}</div>
    </section>
  );
}
