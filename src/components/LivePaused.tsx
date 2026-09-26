"use client";

import { createContext, useContext } from "react";

/** Whether today's live checks are spent, so starter links can open saved data instead. */
export const LivePausedContext = createContext(false);

export function useLivePaused(): boolean {
  return useContext(LivePausedContext);
}

/** A check link, pointed at saved data while live checks are spent. */
export function savedHref(href: string, paused: boolean): string {
  return paused ? `${href}?saved=1` : href;
}
