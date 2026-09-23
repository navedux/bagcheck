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
        Is anyone still buying, or are you the exit?
      </h1>
      <p className="mt-5 max-w-[56ch] text-[15px] leading-[1.6] text-[var(--muted)]">
        Bagcheck looks at one token at a time. It asks Nansen who bought and sold
        it in the last 24 hours, sizes each group against the token&apos;s own
        trading, and tells you what it sees in a couple of words.
      </p>

      <div className="mt-12">
        <AboutRow title="Data">
          Everything comes from the Nansen API: flow intelligence (last day and
          last hour), token info, and who bought and sold. Add a buy date and it
          also pulls the history since then. Checks are cached, so looking twice
          is free.
        </AboutRow>

        <AboutRow title="Who">
          Smart traders, whales, new wallets, public figures, and exchanges. Each
          group&apos;s net buying is measured against the day&apos;s volume, so
          a $10M move means something different on ETH than on a memecoin. It
          counts once it passes {pct(T)} of the day; under {pct(T_QUIET)} is
          quiet. New-wallet flow bigger than a whole day&apos;s volume is usually
          transfers, not buying, so it&apos;s ignored. Tokens heading to exchanges
          win over retail buying.
        </AboutRow>

        <AboutRow title="Answers">
          <span className="block">
            Six things a token can be doing. The tag says which; the big answer
            depends on whether you already hold it.
          </span>
          <span className="about-states mt-5" role="table" aria-label="Flow states and signals">
            <span className="about-state is-head" role="row">
              <span className="col" role="columnheader">What&apos;s happening</span>
              <span className="col" role="columnheader">Thinking of buying</span>
              <span className="col" role="columnheader">Already holding</span>
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
          Tell it when you bought and it also checks everything since that day
          (up to {MAX_HOLD_DAYS} days back). The date stays on your device and in
          links you copy. Nowhere else.
        </AboutRow>

        <AboutRow title="Early exit">
          Under the buyers and sellers: how many of the biggest sellers of the
          last {RECENT_SELL_WINDOW_DAYS} days were big buyers in the token&apos;s
          first {EARLY_WINDOW_DAYS} days. When the early money is the one selling,
          you want to know. Wallet addresses only, never names.
        </AboutRow>

        <AboutRow title="Limits">
          Solana, Ethereum, and Base. Anything under {usd(LIQUIDITY_FLOOR_USD)}{" "}
          liquidity or {usd(VOLUME_FLOOR_USD)} a day in volume is too small to
          read. Buyers and sellers only cover DEX trades. Nansen&apos;s whale and
          exchange tags start on {LABEL_COVERAGE_START}. This tells you what
          wallets did. It&apos;s not financial advice.
        </AboutRow>

        <AboutRow title="Modes">
          The footer says which one you&apos;re on. Live asks Nansen right now.
          Snapshot shows saved Nansen reads for the featured tokens. Sim makes up
          data locally so you can run the app without a key.
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
