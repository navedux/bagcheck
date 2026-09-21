import type { ReactNode } from "react";
import { SIGNAL_LABEL } from "@/lib/copy";
import {
  EARLY_WINDOW_DAYS,
  EXCHANGE_SIGN,
  LIQUIDITY_FLOOR_USD,
  RECENT_SELL_WINDOW_DAYS,
  T,
  T_QUIET,
  UNTRACKED_LIQUIDITY_VOLUME_FLOOR_USD,
  VOLUME_FLOOR_USD,
} from "@/lib/verdict";
import { LABEL_COVERAGE_START, MAX_HOLD_DAYS } from "@/lib/window";

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-6">
      <h1 className="display max-w-[14ch]">One question. Normalized flows.</h1>
      <div className="mt-12">
        <AboutRow title="Method">
          Hold Check scores Nansen cohort net flows against 24h volume (market cap
          if volume is missing). Liquidity under ${LIQUIDITY_FLOOR_USD.toLocaleString()}{" "}
          or volume under ${VOLUME_FLOOR_USD.toLocaleString()} is{" "}
          <em>too thin</em> and is not scored. When Nansen tracks no liquidity
          at all (wrapped natives like WSOL and WETH report zero), the token
          floors on volume alone at a stricter bar ($
          {UNTRACKED_LIQUIDITY_VOLUME_FLOOR_USD.toLocaleString()}).
        </AboutRow>
        <AboutRow title="Thresholds">
          Frozen thresholds: T = {T} (6% of a day&apos;s volume), T_quiet = {T_QUIET}.
          Featured snapshots produce at least three chips at these values.
        </AboutRow>
        <AboutRow title="Signal">
          The loud line is {SIGNAL_LABEL.buy}, {SIGNAL_LABEL.hold},{" "}
          {SIGNAL_LABEL.sell}, {SIGNAL_LABEL["dont-buy"]}, {SIGNAL_LABEL.wait}, or{" "}
          {SIGNAL_LABEL["no-read"]}.
          It depends on whether a buy date is set: looking and holding
          never share a label for still-bid or distribution. The small
          chip names the flow state. The app never writes buy now or
          sell now. Descriptive onchain data, not financial advice.
        </AboutRow>
        <AboutRow title="Stability">
          Under the 30-day strip, one caption says how long the current read
          has held and how many times it flipped in the window. A chip that
          flips every few days reads different from one that has held a month.
        </AboutRow>
        <AboutRow title="Insider exit">
          Under the traders panel: how many of the top sellers from the last{" "}
          {RECENT_SELL_WINDOW_DAYS} days also appear among the biggest buyers
          of the token&apos;s first {EARLY_WINDOW_DAYS} days. Addresses only,
          never labels. When early buyers are this week&apos;s sellers, the
          people who were there first are leaving.
        </AboutRow>
        <AboutRow title="Today board">
          Deferred for v1. The endpoint still exists: it ranks tokens by net
          flow as a share of 24h volume so a major and a memecoin compare by
          relative pressure. Live mode reads the Nansen screener (no
          smart-money filters); sim mode generates daily movers on the same
          math. It may return as a short trending row later.
        </AboutRow>
        <AboutRow title="Data modes">
          Three modes, one interface. <em>Sim</em> is a deterministic
          simulator seeded by token address: ninety days of cohort flows that
          advance daily, no key needed. <em>Snapshot</em> is that world frozen
          at 2026-09-19 for the public deploy. <em>Live</em> calls Nansen when
          a key is present. The footer always says which is running.
        </AboutRow>
        <AboutRow title="Exchange sign">
          Exchange sign is {EXCHANGE_SIGN > 0 ? "positive" : "negative"}{" "}
          <code className="font-mono text-[13px]">exchange_net_flow_usd</code> as
          tokens moving onto exchanges. Spot-checked live on Sep 19, 2026:
          up-days for PEPE, LINK and BRETT paired with exchange outflows,
          flat-to-down days for TRUMP and AERO paired with large deposits.
          Consistent with deposit-to-exchange = positive, with the expected
          noise from DEX-led moves.
        </AboutRow>
        <AboutRow title="Coverage">
          Who bought/sold covers DEX trades only. Tokens sold through a centralized
          exchange do not appear there, and exchange flow means little for
          tokens with no CEX listing. Whale, public figure, top PnL and exchange
          labels in historical flows start on {LABEL_COVERAGE_START}. Entry dates
          before that show only covered cohorts. The hold window is capped at{" "}
          {MAX_HOLD_DAYS} days.
        </AboutRow>
        <AboutRow title="Featured">
          Featured is the last-30-day volume set that fits v1 chains (USDC, WETH,
          WSOL, WBTC, PEPE, LINK, BONK, JUP, AERO, BRETT). Each runs a scripted
          regime schedule in the sim, so history shows real flips. THIN is the
          floor fixture. Public deploy stays snapshot-only.
        </AboutRow>
        <AboutRow title="Floor fixture">
          ethereum{" "}
          <code className="font-mono text-[13px]">
            0x1111111111111111111111111111111111111111
          </code>{" "}
          (THIN).
        </AboutRow>
      </div>
    </main>
  );
}

function AboutRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-2 border-t border-[var(--line)] py-7 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-10">
      <h2 className="section pt-0.5">{title}</h2>
      <p className="max-w-[52ch] text-[15px] leading-[1.6]">{children}</p>
    </section>
  );
}
