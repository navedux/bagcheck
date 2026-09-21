import { describe, expect, it } from "vitest";
import {
  MAX_HOLD_DAYS,
  holdingWindow,
  isPartialCoverage,
  last24hRange,
} from "./window";

describe("holding window", () => {
  it("caps the window at 90 days", () => {
    const now = new Date("2026-09-19T12:00:00.000Z");
    const window = holdingWindow("2024-12-01", now);
    expect(window.from).toBe("2026-06-21");
    expect(window.to).toBe("2026-09-19");
    expect(window.days).toBe(MAX_HOLD_DAYS);
  });

  it("keeps a recent entry date as the start", () => {
    const now = new Date("2026-09-19T12:00:00.000Z");
    const window = holdingWindow("2026-08-03", now);
    expect(window.from).toBe("2026-08-03");
  });

  it("marks pre-11 Mar 2025 as partial coverage", () => {
    expect(isPartialCoverage("2024-12-01")).toBe(true);
    expect(isPartialCoverage("2025-03-11")).toBe(false);
  });

  it("builds a 24h who-bought-sold range", () => {
    const now = new Date("2026-09-19T12:00:00.000Z");
    const range = last24hRange(now);
    expect(range.to).toBe("2026-09-19T12:00:00.000Z");
    expect(range.from).toBe("2026-09-18T12:00:00.000Z");
  });
});
