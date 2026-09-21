import type { Verdict } from "@/lib/types";

/**
 * Categorical palette, after HEX's Grafana system: a color names the verdict
 * category, it never grades it. Green is reserved for brand art and in-flows
 * so no verdict reads as "buy". Quiet and thin stay neutral.
 */
export const VERDICT_TONE: Record<Verdict, string> = {
  "still-bid": "var(--p-cyan)",
  distribution: "var(--p-magenta)",
  "retail-pump": "var(--p-yellow)",
  split: "var(--p-orange)",
  quiet: "var(--muted)",
  "too-thin": "var(--faint)",
};

/** Remix line icons for the flow chip. Color stays on `.sig-block`. */
export const VERDICT_ICON: Record<Verdict, string> = {
  "still-bid": "ri-arrow-up-s-line",
  "retail-pump": "ri-arrow-up-double-line",
  distribution: "ri-arrow-down-s-line",
  split: "ri-arrow-left-right-line",
  quiet: "ri-subtract-line",
  "too-thin": "ri-more-line",
};
