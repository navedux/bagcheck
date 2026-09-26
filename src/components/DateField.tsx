"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ACTION_DATE,
  ACTION_DATE_CLEAR,
  ACTION_DATE_ADD,
  ACTION_DATE_EMPTY,
  ACTION_DATE_NEXT,
  ACTION_DATE_PREV,
  TOAST_DATE,
  TOAST_DATE_CLEARED,
  WEEKDAY_SHORT,
  formatEntryDay,
  formatMonthYear,
} from "@/lib/copy";
import {
  canShiftMonth,
  isoInRange,
  monthGrid,
  parseIsoDay,
  shiftMonth,
} from "@/lib/date-grid";
import { flash } from "@/lib/toast";
import type { Chain } from "@/lib/types";
import { utcDayBounds } from "@/lib/validate";
import { useBag } from "@/components/useBag";

export function DateField({
  chain,
  address,
  urlEntryDate,
}: {
  chain: Chain;
  address: string;
  urlEntryDate?: string;
}) {
  const dateId = useId();
  const gridId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const { ticket, commit } = useBag(chain, address, urlEntryDate);
  const dayBounds = utcDayBounds();
  const today = dayBounds.max;
  const selected = ticket.entryDate;
  const seed = parseIsoDay(selected ?? today);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: seed.year, month: seed.month });
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    width: number;
    origin: string;
  } | null>(null);

  function place() {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.min(Math.max(12, box.left), window.innerWidth - width - 12);
    const originX = Math.round(box.left - left + 16);
    setAnchor({ top: box.bottom + 6, left, width, origin: `${originX}px 0px` });
  }

  function toggle() {
    if (!open) {
      const start = parseIsoDay(ticket.entryDate ?? today);
      setView({ year: start.year, month: start.month });
    }
    setOpen((was) => !was);
  }

  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 200);
    const onDoc = (event: PointerEvent) => {
      if (!armed) return;
      const node = event.target as Node;
      if (triggerRef.current?.contains(node) || popRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(arm);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(iso: string) {
    commit({ ...ticket, entryDate: iso }, true);
    flash(TOAST_DATE);
    setOpen(false);
  }

  function clear() {
    commit({ ...ticket, entryDate: undefined }, true);
    flash(TOAST_DATE_CLEARED);
    setOpen(false);
  }

  function step(delta: number) {
    if (!canShiftMonth(view.year, view.month, delta, dayBounds.min, dayBounds.max)) {
      return;
    }
    setView(shiftMonth(view.year, view.month, delta));
  }

  const cells = monthGrid(view.year, view.month);
  const calendar =
    open && anchor
      ? createPortal(
          <div
            ref={popRef}
            id={gridId}
            className="date-pop"
            role="dialog"
            aria-label={ACTION_DATE}
            style={
              {
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                "--origin": anchor.origin,
              } as CSSProperties
            }
          >
            <div className="date-pop-head">
              <button
                type="button"
                className="date-nav"
                aria-label={ACTION_DATE_PREV}
                disabled={!canShiftMonth(view.year, view.month, -1, dayBounds.min, dayBounds.max)}
                onClick={() => step(-1)}
              >
                <i aria-hidden="true" className="ri-arrow-left-s-line" />
              </button>
              <p className="section">{formatMonthYear(view.year, view.month)}</p>
              <button
                type="button"
                className="date-nav"
                aria-label={ACTION_DATE_NEXT}
                disabled={!canShiftMonth(view.year, view.month, 1, dayBounds.min, dayBounds.max)}
                onClick={() => step(1)}
              >
                <i aria-hidden="true" className="ri-arrow-right-s-line" />
              </button>
            </div>
            <div className="date-dows">
              {WEEKDAY_SHORT.map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className="date-grid">
              {cells.map((iso, index) =>
                iso ? (
                  <button
                    key={iso}
                    type="button"
                    className={[
                      "date-day",
                      iso === selected ? "is-on" : "",
                      iso === today ? "is-today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={!isoInRange(iso, dayBounds.min, dayBounds.max)}
                    aria-pressed={iso === selected}
                    onClick={() => pick(iso)}
                  >
                    {parseIsoDay(iso).day}
                  </button>
                ) : (
                  <span key={`pad-${index}`} className="date-pad" />
                ),
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="field-date-pair">
      <button
        ref={triggerRef}
        type="button"
        id={dateId}
        className={`field-date-wrap${open ? " is-open" : ""}`}
        aria-label={ACTION_DATE}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={gridId}
        onClick={toggle}
      >
        <span className={selected ? "field-date-value" : "field-date-value is-empty"}>
          {selected ? formatEntryDay(selected) : ticket.held ? ACTION_DATE_ADD : ACTION_DATE_EMPTY}
        </span>
        <i aria-hidden="true" className="field-date-icon ri-calendar-line" />
      </button>
      {selected ? (
        <button type="button" className="btn-ghost" onClick={clear}>
          {ACTION_DATE_CLEAR}
        </button>
      ) : null}
      {calendar}
    </span>
  );
}
