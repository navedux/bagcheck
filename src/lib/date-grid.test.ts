import { describe, expect, it } from "vitest";
import {
  canShiftMonth,
  isoInRange,
  isoUtcDay,
  monthGrid,
  parseIsoDay,
  shiftMonth,
} from "./date-grid";

describe("monthGrid", () => {
  it("pads September 2026 from Tuesday", () => {
    const cells = monthGrid(2026, 8);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toBe("2026-09-01");
    expect(cells.at(-1)).toBe("2026-09-30");
  });
});

describe("shiftMonth", () => {
  it("rolls December to January", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("range", () => {
  it("keeps ISO days inside min and max", () => {
    expect(isoInRange("2026-09-20", "2023-09-20", "2026-09-20")).toBe(true);
    expect(isoInRange("2023-09-19", "2023-09-20", "2026-09-20")).toBe(false);
    expect(isoUtcDay(2026, 8, 20)).toBe("2026-09-20");
    expect(parseIsoDay("2026-09-08")).toEqual({ year: 2026, month: 8, day: 8 });
  });

  it("blocks a month that sits wholly outside the window", () => {
    expect(canShiftMonth(2026, 8, 1, "2023-09-20", "2026-09-20")).toBe(false);
    expect(canShiftMonth(2023, 8, -1, "2023-09-20", "2026-09-20")).toBe(false);
    expect(canShiftMonth(2026, 8, -1, "2023-09-20", "2026-09-20")).toBe(true);
  });
});
