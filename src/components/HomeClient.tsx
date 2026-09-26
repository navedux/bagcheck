"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { SAMPLE_WALLET } from "../../data/featured";
import { BrandStrip } from "@/components/BrandStrip";
import { HomeWatch } from "@/components/HomeWatch";
import { TokenPaste, type PasteMode } from "@/components/TokenPaste";
import { TryChips } from "@/components/TryTokens";
import {
  HOME_AGAIN,
  HOME_EYEBROW,
  HOME_HEAD,
  HOME_NEXT,
  HOME_NEXT_WALLET,
  HOME_OR,
  WALLET_SAMPLE,
} from "@/lib/copy";
import { followSnapshot, parseFollowing, subscribeFollow } from "@/lib/storage";

function SampleWallet() {
  if (!SAMPLE_WALLET) return null;
  return (
    <Link
      href={`/w/${SAMPLE_WALLET.kind}/${SAMPLE_WALLET.address}`}
      className="caption text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
    >
      {WALLET_SAMPLE}
    </Link>
  );
}

export function HomeClient() {
  const followRaw = useSyncExternalStore(subscribeFollow, followSnapshot, () => "[]");
  const hasList = parseFollowing(followRaw).length > 0;
  const [mode, setMode] = useState<PasteMode>("token");

  if (hasList) {
    return (
      <>
        <section>
          <h2 className="section">{HOME_AGAIN}</h2>
          <div className="mt-4">
            <TokenPaste autoFocus={false} mode={mode} onModeChange={setMode} />
          </div>
          {mode === "wallet" ? (
            <p className="mt-4">
              <SampleWallet />
            </p>
          ) : (
            <>
              <h3 className="section mt-8">{HOME_OR}</h3>
              <TryChips />
            </>
          )}
        </section>
        <div className="mt-12">
          <HomeWatch />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-6">
        <p className="col">{HOME_EYEBROW}</p>
        <div className="hidden sm:block">
          <BrandStrip />
        </div>
      </div>
      <h1 className="display mt-4">{HOME_HEAD}</h1>
      <div className="mt-6">
        <TokenPaste mode={mode} onModeChange={setMode} />
      </div>
      <p className="caption mt-4 max-w-md">{mode === "wallet" ? HOME_NEXT_WALLET : HOME_NEXT}</p>
      {mode === "wallet" ? (
        <p className="mt-3">
          <SampleWallet />
        </p>
      ) : null}
      <div className="mt-12">
        <HomeWatch />
      </div>
    </>
  );
}
