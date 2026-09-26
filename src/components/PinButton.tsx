"use client";

import { useState, useSyncExternalStore } from "react";
import {
  TOAST_FOLLOW,
  TOAST_FOLLOW_FAIL,
  TOAST_FOLLOW_FULL,
  TOAST_UNFOLLOW,
  WATCH_ADD_ON,
  WATCH_PIN,
  WATCH_REMOVE,
} from "@/lib/copy";
import {
  addFollow,
  followSnapshot,
  isFollowing,
  subscribeFollow,
  toggleFollow,
} from "@/lib/storage";
import { track, type BagSource } from "@/lib/analytics";
import { flash } from "@/lib/toast";
import type { Chain } from "@/lib/types";

export function PinButton({
  chain,
  address,
  symbol,
  labeled = false,
  source = "list",
}: {
  chain: Chain;
  address: string;
  symbol: string;
  labeled?: boolean;
  source?: BagSource;
}) {
  const followRaw = useSyncExternalStore(subscribeFollow, followSnapshot, () => "[]");
  const following = isFollowing(chain, address, followRaw);
  const [open, setOpen] = useState(false);
  const tip = following ? WATCH_REMOVE : WATCH_PIN;

  return (
    <button
      type="button"
      className={`pin-btn${following ? " is-on" : ""}${labeled ? " is-labeled" : ""}${open ? " is-tip" : ""}`}
      aria-label={tip}
      aria-pressed={following}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => {
        if (following) {
          toggleFollow({ chain, address, symbol });
          flash(TOAST_UNFOLLOW);
          return;
        }
        const result = addFollow({ chain, address, symbol });
        if (result === "added") {
          flash(TOAST_FOLLOW);
          track("bag_added", { chain, from: source });
        }
        else if (result === "full") flash(TOAST_FOLLOW_FULL);
        else if (result === "failed") flash(TOAST_FOLLOW_FAIL);
      }}
    >
      <i aria-hidden="true" className={following ? "ri-pushpin-fill" : "ri-pushpin-line"} />
      {labeled ? <span>{following ? WATCH_ADD_ON : WATCH_PIN}</span> : null}
      <span className="pin-tip" role="tooltip" aria-hidden="true">
        {tip}
      </span>
    </button>
  );
}
