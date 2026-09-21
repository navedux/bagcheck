"use client";

import { ACTION_COPY, TOAST_COPIED } from "@/lib/copy";
import { checkPath } from "@/lib/format";
import { flash } from "@/lib/toast";
import type { Chain } from "@/lib/types";

export function CopyLinkButton({
  chain,
  address,
  entryDate,
}: {
  chain: Chain;
  address: string;
  entryDate?: string;
}) {
  return (
    <button
      type="button"
      className="pin-btn is-labeled"
      aria-label={ACTION_COPY}
      onClick={() => {
        const href = new URL(checkPath(chain, address, entryDate), window.location.origin);
        void navigator.clipboard.writeText(href.toString()).then(() => flash(TOAST_COPIED));
      }}
    >
      <i aria-hidden="true" className="ri-link" />
      <span>{ACTION_COPY}</span>
    </button>
  );
}
