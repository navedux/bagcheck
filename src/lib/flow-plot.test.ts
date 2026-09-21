import { describe, expect, it } from "vitest";
import { parallelPlot, ribbonPath } from "./flow-plot";
import { flowBridge } from "./verdict";
import type { CohortFlows } from "./types";

const flows: CohortFlows = {
  smartTraderNetFlowUsd: 300_000,
  whaleNetFlowUsd: 150_000,
  publicFigureNetFlowUsd: 20_000,
  exchangeNetFlowUsd: -100_000,
  freshWalletsNetFlowUsd: -30_000,
};

describe("parallelPlot", () => {
  it("places in, then net, then out", () => {
    const plot = parallelPlot(flowBridge(flows, 6_000_000), 800, 300);
    expect(plot.xIn).toBeLessThan(plot.xNet);
    expect(plot.xNet).toBeLessThan(plot.xOut);
    expect(plot.ins.map((band) => band.key)).toEqual([
      "traders",
      "whales",
      "exchanges",
      "figures",
    ]);
    expect(plot.outs.map((band) => band.key)).toEqual(["fresh"]);
    expect(plot.net.usd).toBe(540_000);
    expect(plot.net.h).toBeGreaterThan(0);
  });

  it("keeps net-edge slices in the same cohort order", () => {
    const plot = parallelPlot(flowBridge(flows, 6_000_000), 800, 300);
    expect(plot.inSlices.map((band) => band.key)).toEqual(
      plot.ins.map((band) => band.key),
    );
    expect(plot.outSlices.map((band) => band.key)).toEqual(
      plot.outs.map((band) => band.key),
    );
  });

  it("still plots a negative net as a middle column", () => {
    const plot = parallelPlot(
      flowBridge(
        {
          smartTraderNetFlowUsd: 10_000,
          whaleNetFlowUsd: 0,
          publicFigureNetFlowUsd: 0,
          exchangeNetFlowUsd: 90_000,
          freshWalletsNetFlowUsd: 0,
        },
        1_000_000,
      ),
      800,
      300,
    );
    expect(plot.net.usd).toBe(-80_000);
    expect(plot.ins).toHaveLength(1);
    expect(plot.outs[0]?.key).toBe("exchanges");
  });
});

describe("ribbonPath", () => {
  it("closes a band from one edge to the other", () => {
    const d = ribbonPath(0, 10, 20, 100, 30, 10);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("100,30");
  });
});
