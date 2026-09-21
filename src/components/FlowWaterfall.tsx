"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  FLOW_CAPTION,
  FLOW_EMPTY,
  FLOW_HEAD,
  FLOW_IN,
  FLOW_LABEL,
  FLOW_NET,
  FLOW_OUT,
  flowNetLine,
} from "@/lib/copy";
import { formatPctOfVol, formatSignedUsd } from "@/lib/format";
import { parallelPlot, ribbonPath, type FlowPlotBand } from "@/lib/flow-plot";
import type { CohortFlows } from "@/lib/types";
import { flowBridge } from "@/lib/verdict";

type Hover = {
  label: string;
  usd: number;
  x: number;
  y: number;
} | null;

function usePlotWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setWidth(el.clientWidth);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function BandLabel({
  band,
  x,
  anchor,
}: {
  band: FlowPlotBand;
  x: number;
  anchor: "start" | "end";
}) {
  const mid = band.y + band.h / 2;
  if (band.h < 22) {
    return (
      <text className="flow-tag" x={x} y={mid + 3} textAnchor={anchor}>
        {FLOW_LABEL[band.key]} {formatSignedUsd(band.usd)}
      </text>
    );
  }
  return (
    <text className="flow-tag" x={x} y={mid} textAnchor={anchor}>
      <tspan x={x} dy="-0.35em">
        {FLOW_LABEL[band.key]}
      </tspan>
      <tspan className="flow-amt" x={x} dy="1.25em">
        {formatSignedUsd(band.usd)}
      </tspan>
    </text>
  );
}

export function FlowWaterfall({
  flows,
  refUsd,
}: {
  flows: CohortFlows;
  refUsd: number;
  lit?: boolean;
}) {
  const { ref, width } = usePlotWidth();
  const [hover, setHover] = useState<Hover>(null);
  const bridge = flowBridge(flows, refUsd);
  const height = 320;
  const empty = bridge.legs.length === 0;
  const plot = !empty && width > 0 ? parallelPlot(bridge, width, height) : null;

  function mark(
    label: string,
    usd: number,
    event: PointerEvent<SVGElement>,
  ) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setHover({
      label,
      usd,
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    });
  }

  return (
    <section className="border-ticks border-t border-[var(--line)] pt-10">
      <h2 className="section">{FLOW_HEAD}</h2>
      {empty ? (
        <p className="stance mt-4">{FLOW_EMPTY}</p>
      ) : (
        <ul className="flow-key">
        <li>
          <span
            aria-hidden="true"
            className="sig-block"
            style={{ "--sig": "var(--in)" } as CSSProperties}
          />
          {FLOW_IN}
        </li>
        <li>
          <span
            aria-hidden="true"
            className="sig-block"
            style={{ "--sig": "var(--ink)" } as CSSProperties}
          />
          {FLOW_NET}
        </li>
        <li>
          <span
            aria-hidden="true"
            className="sig-block"
            style={{ "--sig": "var(--out)" } as CSSProperties}
          />
          {FLOW_OUT}
        </li>
      </ul>
      )}
      {empty ? null : (
      <div ref={ref} className="flow-chart">
        {plot ? (
          <svg
            width={plot.width}
            height={plot.height}
            viewBox={`0 0 ${plot.width} ${plot.height}`}
            role="img"
            aria-label={`${FLOW_IN} ${formatSignedUsd(bridge.inUsd)}, ${FLOW_NET} ${formatSignedUsd(bridge.netUsd)}, ${FLOW_OUT} ${formatSignedUsd(-bridge.outUsd)}`}
            onPointerLeave={() => setHover(null)}
          >
            <line
              className="flow-axis"
              x1={plot.xIn}
              x2={plot.xIn}
              y1={plot.axisY0}
              y2={plot.axisY1}
            />
            <line
              className="flow-axis"
              x1={plot.xNet + plot.netW / 2}
              x2={plot.xNet + plot.netW / 2}
              y1={plot.axisY0}
              y2={plot.axisY1}
            />
            <line
              className="flow-axis"
              x1={plot.xOut}
              x2={plot.xOut}
              y1={plot.axisY0}
              y2={plot.axisY1}
            />

            {plot.ins.map((band, index) => {
              const slice = plot.inSlices[index];
              if (!slice) return null;
              return (
                <path
                  key={`in-${band.key}`}
                  className="flow-ribbon is-in"
                  style={{ opacity: Math.max(0.5, 1 - index * 0.16) }}
                  d={ribbonPath(
                    plot.xIn,
                    band.y,
                    band.h,
                    plot.xNet,
                    slice.y,
                    slice.h,
                  )}
                  onPointerMove={(event) =>
                    mark(FLOW_LABEL[band.key], band.usd, event)
                  }
                />
              );
            })}
            {plot.outs.map((band, index) => {
              const slice = plot.outSlices[index];
              if (!slice) return null;
              return (
                <path
                  key={`out-${band.key}`}
                  className="flow-ribbon is-out"
                  style={{ opacity: Math.max(0.5, 1 - index * 0.16) }}
                  d={ribbonPath(
                    plot.xNet + plot.netW,
                    slice.y,
                    slice.h,
                    plot.xOut,
                    band.y,
                    band.h,
                  )}
                  onPointerMove={(event) =>
                    mark(FLOW_LABEL[band.key], band.usd, event)
                  }
                />
              );
            })}

            <rect
              className="flow-net"
              x={plot.xNet}
              y={plot.net.y}
              width={plot.netW}
              height={plot.net.h}
              onPointerMove={(event) => mark(FLOW_NET, plot.net.usd, event)}
            />

            {plot.ins.map((band) => (
              <BandLabel
                key={`in-l-${band.key}`}
                band={band}
                x={plot.xIn - 10}
                anchor="end"
              />
            ))}
            {plot.outs.map((band) => (
              <BandLabel
                key={`out-l-${band.key}`}
                band={band}
                x={plot.xOut + 10}
                anchor="start"
              />
            ))}

            <text
              className={
                plot.net.h >= 40 ? "flow-net-word is-on" : "flow-net-word"
              }
              x={plot.xNet + plot.netW / 2}
              y={
                plot.net.h >= 40
                  ? plot.net.y + plot.net.h / 2
                  : plot.net.y - 14
              }
              textAnchor="middle"
            >
              <tspan x={plot.xNet + plot.netW / 2} dy="-0.35em">
                {FLOW_NET}
              </tspan>
              <tspan
                className="flow-amt"
                x={plot.xNet + plot.netW / 2}
                dy="1.25em"
              >
                {formatSignedUsd(plot.net.usd)}
              </tspan>
            </text>

            <text
              className="flow-axis-label"
              x={plot.xIn}
              y={plot.height - 8}
              textAnchor="middle"
            >
              {FLOW_IN}
            </text>
            <text
              className="flow-axis-label"
              x={plot.xNet + plot.netW / 2}
              y={plot.height - 8}
              textAnchor="middle"
            >
              {FLOW_NET}
            </text>
            <text
              className="flow-axis-label"
              x={plot.xOut}
              y={plot.height - 8}
              textAnchor="middle"
            >
              {FLOW_OUT}
            </text>
          </svg>
        ) : null}
        {hover ? (
          <div
            className="flow-tip"
            style={{ left: hover.x, top: hover.y }}
          >
            <span className="col">{hover.label}</span>
            <span className="num">{formatSignedUsd(hover.usd)}</span>
          </div>
        ) : null}
      </div>
      )}
      {empty ? null : (
        <ul className="sr-only">
          {bridge.ins.map((leg) => (
            <li key={`a-in-${leg.key}`}>
              {FLOW_IN} {FLOW_LABEL[leg.key]} {formatSignedUsd(leg.usd)}
            </li>
          ))}
          <li>
            {FLOW_NET} {formatSignedUsd(bridge.netUsd)}
          </li>
          {bridge.outs.map((leg) => (
            <li key={`a-out-${leg.key}`}>
              {FLOW_OUT} {FLOW_LABEL[leg.key]} {formatSignedUsd(leg.usd)}
            </li>
          ))}
        </ul>
      )}
      {empty ? null : (
        <p className="stance mt-4">
          {flowNetLine(formatSignedUsd(bridge.netUsd), formatPctOfVol(bridge.netShare))}
        </p>
      )}
      <p className={`caption${empty ? " mt-4" : " mt-1"}`}>{FLOW_CAPTION}</p>
    </section>
  );
}
