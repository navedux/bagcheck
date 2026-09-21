import { z } from "zod";
import type { BagRule, Verdict } from "./types";
import { entryDateSchema } from "./validate";

export const BAG_RULES = [
  "off",
  "fold-on-distribution",
  "fold-on-retail-pump",
] as const;

export const RULE_LABEL: Record<(typeof BAG_RULES)[number], string> = {
  off: "Off",
  "fold-on-distribution": "Sell on distribution",
  "fold-on-retail-pump": "Sell on retail pump",
};

export const bagRuleSchema = z.enum(BAG_RULES);

export const bagTicketSchema = z
  .object({
    entryDate: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      entryDateSchema.optional(),
    ),
    sizeUsd: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().nonnegative().max(1_000_000_000).optional(),
    ),
    costUsd: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().nonnegative().max(1_000_000_000).optional(),
    ),
    rule: bagRuleSchema.default("off"),
  })
  .strict();

export type BagTicket = z.infer<typeof bagTicketSchema>;

export const emptyBag: BagTicket = { rule: "off" };

export function ruleFolds(rule: BagRule, verdict: Verdict): boolean {
  return (
    (rule === "fold-on-distribution" && verdict === "distribution") ||
    (rule === "fold-on-retail-pump" && verdict === "retail-pump")
  );
}
