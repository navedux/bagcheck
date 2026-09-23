import { describe, expect, it } from "vitest";
import { ColdGate } from "./cold-gate";

const T0 = Date.parse("2026-09-23T10:00:00.000Z");

describe("cold gate", () => {
  it("caps cold checks per client per hour", () => {
    const gate = new ColdGate(() => ({ perClientPerHour: 2, globalPerHour: 100 }));
    expect(gate.admit("a", T0)).toBe(true);
    expect(gate.admit("a", T0)).toBe(true);
    expect(gate.admit("a", T0)).toBe(false);
    expect(gate.admit("b", T0)).toBe(true);
  });

  it("resets a client after the hour", () => {
    const gate = new ColdGate(() => ({ perClientPerHour: 1, globalPerHour: 100 }));
    expect(gate.admit("a", T0)).toBe(true);
    expect(gate.admit("a", T0 + 59 * 60_000)).toBe(false);
    expect(gate.admit("a", T0 + 60 * 60_000)).toBe(true);
  });

  it("caps the instance even when clients rotate", () => {
    const gate = new ColdGate(() => ({ perClientPerHour: 5, globalPerHour: 3 }));
    expect(gate.admit("a", T0)).toBe(true);
    expect(gate.admit("b", T0)).toBe(true);
    expect(gate.admit("c", T0)).toBe(true);
    expect(gate.admit("d", T0)).toBe(false);
  });

  it("lets exempt checks skip the client cap but not the global cap", () => {
    const gate = new ColdGate(() => ({ perClientPerHour: 1, globalPerHour: 3 }));
    expect(gate.admit("a", T0)).toBe(true);
    expect(gate.admit("a", T0, true)).toBe(true);
    expect(gate.admit("a", T0, true)).toBe(true);
    expect(gate.admit("a", T0, true)).toBe(false);
  });
});
