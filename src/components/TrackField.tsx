"use client";

import { useState, type CSSProperties } from "react";
import { VERDICT_TONE } from "@/lib/brand";
import { VERDICT_LABEL, formatEntryDay } from "@/lib/copy";
import { formatUsd } from "@/lib/format";
import type { DayFlows, Verdict, VerdictDay } from "@/lib/types";

const FIELD = {
  maxHeight: 72, // px tallest volume column
  floor: 2, // px so a quiet day still reads
};

const KEY_ORDER: Verdict[] = [
  "still-bid",
  "retail-pump",
  "distribution",
  "split",
  "quiet",
  "too-thin",
];

function keyOf(history: VerdictDay[]): Verdict[] {
  const seen = new Set(history.map((day) => day.verdict));
  return KEY_ORDER.filter((verdict) => seen.has(verdict));
}

export function TrackField({
  daily,
  history,
  lit,
  stagger = 0,
}: {
  daily: DayFlows[];
  history: VerdictDay[];
  lit: boolean;
  stagger?: number;
}) {
  const last = history.length - 1;
  const [active, setActive] = useState(last);
  const byDay = new Map(daily.map((day) => [day.day, day.volumeUsd]));
  const peak = Math.max(...history.map((day) => byDay.get(day.day) ?? 0), 1);
  const current = history[active] ?? history[last];
  const volume = current ? (byDay.get(current.day) ?? 0) : 0;
  const key = keyOf(history);

  if (!current) return null;

  return (
    <div>
      <div
        className={lit ? "track-plot is-lit" : "track-plot"}
        style={{ "--n": history.length } as CSSProperties}
        onMouseLeave={() => setActive(last)}
      >
        {history.map((day, index) => {
          const dayVolume = byDay.get(day.day) ?? 0;
          const height = Math.max(FIELD.floor, (dayVolume / peak) * FIELD.maxHeight);
          const on = index === active;
          return (
            <button
              key={day.day}
              type="button"
              className={on ? "track-day is-on" : "track-day"}
              aria-label={`${formatEntryDay(day.day)} · ${VERDICT_LABEL[day.verdict]} · ${formatUsd(dayVolume)}`}
              aria-pressed={on}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              style={
                {
                  "--cell": VERDICT_TONE[day.verdict],
                  "--cell-i": index,
                  "--cell-stagger": `${stagger}ms`,
                  "--vol-h": `${height}px`,
                } as CSSProperties
              }
            >
              <span className="vol-col" />
              <span className="strip-cell" />
            </button>
          );
        })}
      </div>
      <div className="track-legend">
        <span
          aria-hidden="true"
          className="sig-block"
          style={{ "--sig": VERDICT_TONE[current.verdict] } as CSSProperties}
        />
        <p className="text-[15px]">{VERDICT_LABEL[current.verdict]}</p>
        <p className="num text-[var(--muted)]">{formatEntryDay(current.day)}</p>
        {daily.length > 0 ? (
          <p className="num text-[var(--muted)]">{formatUsd(volume)}</p>
        ) : null}
      </div>
      {key.length > 0 ? (
        <ul className="track-key">
          {key.map((verdict) => (
            <li key={verdict}>
              <span
                aria-hidden="true"
                className="sig-block"
                style={{ "--sig": VERDICT_TONE[verdict] } as CSSProperties}
              />
              {VERDICT_LABEL[verdict]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
