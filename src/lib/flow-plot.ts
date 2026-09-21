import type { FlowBridge, FlowCohort } from "./types";

export type FlowPlotBand = {
  key: FlowCohort;
  usd: number;
  y: number;
  h: number;
};

export type FlowPlot = {
  ins: FlowPlotBand[];
  outs: FlowPlotBand[];
  inSlices: FlowPlotBand[];
  outSlices: FlowPlotBand[];
  net: { usd: number; y: number; h: number };
  xIn: number;
  xNet: number;
  xOut: number;
  netW: number;
  width: number;
  height: number;
  axisY0: number;
  axisY1: number;
};

const PAD_TOP = 20;
const PAD_BOTTOM = 28;
const GAP = 6;
const NET_MIN = 10;

function stack(
  items: { key: FlowCohort; usd: number }[],
  top: number,
  height: number,
  gap: number,
): FlowPlotBand[] {
  if (items.length === 0 || height <= 0) return [];
  const gaps = Math.max(0, items.length - 1) * gap;
  const inner = Math.max(height - gaps, 0);
  const total = items.reduce((sum, item) => sum + Math.abs(item.usd), 0);
  let y = top;
  return items.map((item, index) => {
    const share = total > 0 ? Math.abs(item.usd) / total : 0;
    const h = inner * share;
    const band = { key: item.key, usd: item.usd, y, h };
    y += h + (index < items.length - 1 ? gap : 0);
    return band;
  });
}

/**
 * Three columns, shared USD scale: ins on the left, net in the middle,
 * outs on the right. Slices on the net edges keep ribbon attachments
 * in the same cohort order.
 */
export function parallelPlot(
  bridge: FlowBridge,
  width: number,
  height: number,
): FlowPlot {
  const label = width < 520 ? 76 : 120;
  const netW = width < 520 ? 56 : 88;
  const xIn = label;
  const xOut = width - label;
  const xNet = (width - netW) / 2;
  const axisY0 = PAD_TOP;
  const axisY1 = height - PAD_BOTTOM;
  const usable = Math.max(axisY1 - axisY0, 1);

  const inUsd = Math.max(bridge.inUsd, 0);
  const outUsd = Math.max(bridge.outUsd, 0);
  const netAbs = Math.abs(bridge.netUsd);
  const maxUsd = Math.max(inUsd, outUsd, netAbs, 1);
  const extraGap = Math.max(
    Math.max(0, bridge.ins.length - 1) * GAP,
    Math.max(0, bridge.outs.length - 1) * GAP,
  );
  const scale = Math.max(usable - extraGap, 1) / maxUsd;

  const inH = inUsd * scale + Math.max(0, bridge.ins.length - 1) * GAP;
  const outH = outUsd * scale + Math.max(0, bridge.outs.length - 1) * GAP;
  const netH = Math.max(netAbs * scale, bridge.netUsd === 0 ? 2 : NET_MIN);

  const ins = stack(bridge.ins, axisY0 + (usable - inH) / 2, inH, GAP);
  const outs = stack(bridge.outs, axisY0 + (usable - outH) / 2, outH, GAP);
  const netY = axisY0 + (usable - netH) / 2;
  const inSlices = stack(bridge.ins, netY, netH, GAP);
  const outSlices = stack(bridge.outs, netY, netH, GAP);

  return {
    ins,
    outs,
    inSlices,
    outSlices,
    net: { usd: bridge.netUsd, y: netY, h: netH },
    xIn,
    xNet,
    xOut,
    netW,
    width,
    height,
    axisY0,
    axisY1,
  };
}

/** Alluvial band from a vertical edge to another. */
export function ribbonPath(
  x0: number,
  y0: number,
  h0: number,
  x1: number,
  y1: number,
  h1: number,
): string {
  const mid = (x0 + x1) / 2;
  const b0 = y0 + Math.max(h0, 0.5);
  const b1 = y1 + Math.max(h1, 0.5);
  return `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1} L${x1},${b1} C${mid},${b1} ${mid},${b0} ${x0},${b0} Z`;
}
