"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChainMark } from "@/components/ChainMark";
import {
  CHAIN_AUTO,
  CHAIN_LABEL,
  CHAIN_MENU,
  chainAutoHint,
} from "@/lib/copy";
import { CHAINS, type ChainChoice } from "@/lib/types";
import type { ChainGuess } from "@/lib/validate";

const OPTIONS: ChainChoice[] = ["auto", ...CHAINS];

/**
 * ANIMATION STORYBOARD
 *    0ms   trigger sits in the paste shell
 *  open    menu ports to body, 180ms scale 0.96 from the trigger
 *  close   instant (high-frequency listbox)
 *  Escape  instant
 */
export function ChainPicker({
  value,
  onChange,
  guess,
}: {
  value: ChainChoice;
  onChange: (value: ChainChoice) => void;
  guess?: ChainGuess | null;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    width: number;
    origin: string;
  } | null>(null);
  const detected = value === "auto" ? (guess ?? null) : null;

  function place() {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.max(box.width, 196);
    const left = Math.min(Math.max(12, box.left), window.innerWidth - width - 12);
    const below = box.bottom + 6;
    const height = 220;
    const flip = below + height > window.innerHeight - 12;
    const top = flip ? box.top - height - 6 : below;
    const originX = Math.round(box.left - left + 20);
    setAnchor({
      top: Math.max(12, top),
      left,
      width,
      origin: `${originX}px ${flip ? "100%" : "0px"}`,
    });
  }

  function toggle() {
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
      if (triggerRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    const frame = window.requestAnimationFrame(() => menuRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(arm);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: ChainChoice) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onListKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const index = OPTIONS.indexOf(value);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length];
      if (next) onChange(next);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    if (event.key === "Home") {
      event.preventDefault();
      onChange("auto");
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange("base");
    }
  }

  const triggerMark = value === "auto" ? detected?.chain : value;

  const menu =
    open && anchor
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            className="chain-menu"
            role="listbox"
            aria-label={CHAIN_MENU}
            tabIndex={-1}
            style={
              {
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                "--origin": anchor.origin,
              } as CSSProperties
            }
            onKeyDown={onListKey}
          >
            {OPTIONS.map((option) => {
              const selected = value === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="chain-option"
                  onClick={() => pick(option)}
                >
                  <span className="chain-option-mark">
                    {option === "auto" ? (
                      <i aria-hidden="true" className="ri-scan-line" />
                    ) : (
                      <ChainMark chain={option} size={18} circled />
                    )}
                  </span>
                  <span className="chain-option-copy">
                    <span className="chain-option-name">
                      {option === "auto" ? CHAIN_AUTO : CHAIN_LABEL[option]}
                    </span>
                    {option === "auto" ? (
                      <span className="caption">{chainAutoHint(detected)}</span>
                    ) : null}
                  </span>
                  {selected ? <i aria-hidden="true" className="ri-check-line" /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="chain-pick">
      <button
        ref={triggerRef}
        type="button"
        className={`chain-trigger${open ? " is-open" : ""}`}
        aria-label={CHAIN_MENU}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
      >
        {triggerMark ? <ChainMark chain={triggerMark} size={18} circled /> : (
          <i aria-hidden="true" className="ri-scan-line" />
        )}
        <span>{value === "auto" ? CHAIN_AUTO : CHAIN_LABEL[value]}</span>
        <i aria-hidden="true" className="chain-chevron ri-arrow-down-s-line" />
      </button>
      {menu}
    </div>
  );
}
