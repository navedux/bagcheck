import { describe, expect, it } from "vitest";
import { bagTicketSchema, emptyBag, ruleFolds } from "./bag";

describe("bag ticket", () => {
  it("defaults the rule to off", () => {
    expect(emptyBag.rule).toBe("off");
    expect(ruleFolds("off", "distribution")).toBe(false);
  });

  it("folds only when the chosen rule matches the chip", () => {
    expect(ruleFolds("fold-on-distribution", "distribution")).toBe(true);
    expect(ruleFolds("fold-on-distribution", "still-bid")).toBe(false);
    expect(ruleFolds("fold-on-retail-pump", "retail-pump")).toBe(true);
  });

  it("rejects a future entry date", () => {
    const parsed = bagTicketSchema.safeParse({
      entryDate: "2099-01-01",
      rule: "off",
    });
    expect(parsed.success).toBe(false);
  });
});
