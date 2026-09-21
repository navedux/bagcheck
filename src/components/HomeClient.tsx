"use client";

import { useSyncExternalStore } from "react";
import { BrandStrip } from "@/components/BrandStrip";
import { HomeWatch } from "@/components/HomeWatch";
import { TokenPaste } from "@/components/TokenPaste";
import { TryChips } from "@/components/TryTokens";
import { HOME_AGAIN, HOME_EYEBROW, HOME_HEAD, HOME_NEXT, HOME_OR } from "@/lib/copy";
import { followSnapshot, parseFollowing, subscribeFollow } from "@/lib/storage";

export function HomeClient() {
  const followRaw = useSyncExternalStore(subscribeFollow, followSnapshot, () => "[]");
  const hasList = parseFollowing(followRaw).length > 0;

  if (hasList) {
    return (
      <>
        <section>
          <h2 className="section">{HOME_AGAIN}</h2>
          <div className="mt-4">
            <TokenPaste autoFocus={false} />
          </div>
          <h3 className="section mt-8">{HOME_OR}</h3>
          <TryChips />
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
        <TokenPaste />
      </div>
      <p className="caption mt-4 max-w-md">{HOME_NEXT}</p>
      <div className="mt-12">
        <HomeWatch />
      </div>
    </>
  );
}
