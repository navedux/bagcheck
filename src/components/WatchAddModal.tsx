"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ChainMark } from "@/components/ChainMark";
import { ChainPicker } from "@/components/ChainPicker";
import { TokenMark } from "@/components/TokenMark";
import {
  PASTE_PLACEHOLDER,
  pasteLine,
  pasteAutoLine,
  TOAST_FOLLOW,
  TOAST_FOLLOW_FAIL,
  TOAST_FOLLOW_FULL,
  TOAST_UNFOLLOW,
  WATCH_ADD_ACTION,
  WATCH_ADD_CLOSE,
  WATCH_ADD_FAIL,
  watchAddListEmpty,
  WATCH_ADD_FULL,
  WATCH_ADD_ON,
  WATCH_ADD_PASTE,
  WATCH_REMOVE_SHORT,
  WATCH_ADD_RETRY,
  WATCH_ADD_SEARCH,
  WATCH_ADD_TITLE,
} from "@/lib/copy";
import {
  addFollow,
  followSnapshot,
  isFollowing,
  parseFollowing,
  subscribeFollow,
  toggleFollow,
} from "@/lib/storage";
import { flash } from "@/lib/toast";
import type { Chain, ChainChoice } from "@/lib/types";
import {
  detectChain,
  FOLLOW_LIMIT,
  normalizeAddress,
  pasteIssueFor,
  pasteShownIssue,
  resolvePasteChain,
} from "@/lib/validate";
import {
  catalogSymbol,
  filterCatalog,
  mergeCatalog,
  parseCatalog,
  staticCatalog,
} from "@/lib/watch-search";

type LoadState = "loading" | "ok" | "fallback";

export function WatchAddModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const searchId = useId();
  const pasteId = useId();
  const errorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const priorRef = useRef<HTMLElement | null>(null);
  const leaveTimer = useRef(0);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState(staticCatalog);
  const [load, setLoad] = useState<LoadState>("loading");
  const [reload, setReload] = useState(0);
  const [pasteChoice, setPasteChoice] = useState<ChainChoice>("auto");
  const [pasteAddress, setPasteAddress] = useState("");
  const [pasteTouched, setPasteTouched] = useState(false);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [leave, setLeave] = useState(false);
  const followRaw = useSyncExternalStore(subscribeFollow, followSnapshot, () => "[]");

  const following = parseFollowing(followRaw);
  const full = following.length >= FOLLOW_LIMIT;
  const shown = filterCatalog(catalog, query);
  const guess = pasteChoice === "auto" ? detectChain(pasteAddress, catalog) : null;
  const issue = pasteIssueFor(pasteChoice, pasteAddress);
  const pasteShown = pasteShownIssue(issue, pasteTouched);
  const pasteMessage = pasteNote ?? (pasteShown ? pasteLine(pasteShown) : null);
  const pasteHint = !pasteMessage ? pasteAutoLine(pasteChoice, guess, issue) : null;
  const pasteChain = resolvePasteChain(pasteChoice, pasteAddress, catalog);

  useEffect(() => {
    priorRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(leaveTimer.current);
      document.body.style.overflow = prevOverflow;
      priorRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setLoad("loading");
    fetch("/api/featured", { signal: ac.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad"))))
      .then((json: unknown) => {
        const live = parseCatalog(json);
        setCatalog(mergeCatalog(staticCatalog(), live));
        setLoad(live.length > 0 ? "ok" : "fallback");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalog(staticCatalog());
        setLoad("fallback");
      });
    return () => ac.abort();
  }, [reload]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !rootRef.current) return;
      const nodes = [
        ...rootRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function report(result: ReturnType<typeof addFollow>, viaPaste: boolean) {
    if (result === "added") {
      flash(TOAST_FOLLOW);
      if (viaPaste) {
        setPasteAddress("");
        setPasteTouched(false);
        setPasteNote(null);
      }
      return;
    }
    if (result === "exists") {
      if (viaPaste) setPasteNote(WATCH_ADD_ON);
      return;
    }
    if (result === "full") {
      if (viaPaste) setPasteNote(WATCH_ADD_FULL);
      else flash(TOAST_FOLLOW_FULL);
      return;
    }
    if (viaPaste) setPasteNote(TOAST_FOLLOW_FAIL);
    else flash(TOAST_FOLLOW_FAIL);
  }

  function addToken(chain: Chain, address: string, symbol: string, viaPaste: boolean) {
    if (full) {
      report("full", viaPaste);
      return;
    }
    report(addFollow({ chain, address, symbol }), viaPaste);
  }

  function dropToken(chain: Chain, address: string, symbol: string) {
    toggleFollow({ chain, address, symbol });
    flash(TOAST_UNFOLLOW);
    setPasteNote(null);
  }

  function onPaste(event: FormEvent) {
    event.preventDefault();
    setPasteTouched(true);
    setPasteNote(null);
    if (issue !== "ok") return;
    if (!pasteChain) return;
    const symbol = catalogSymbol(catalog, pasteChain, pasteAddress);
    addToken(pasteChain, normalizeAddress(pasteAddress), symbol, true);
  }

  function requestClose() {
    if (leave) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setLeave(true);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(onClose, 160);
  }

  const dialog = (
    <div className={`sheet-root${leave ? " is-leave" : ""}`} role="presentation">
      <button type="button" className="sheet-mask" aria-label={WATCH_ADD_CLOSE} onClick={requestClose} />
      <div
        ref={rootRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sheet-head">
          <div>
            <h2 id={titleId} className="section">
              {WATCH_ADD_TITLE}
            </h2>
            <p className="col mt-1">
              {following.length} / {FOLLOW_LIMIT}
            </p>
          </div>
          <button type="button" className="sheet-x" aria-label={WATCH_ADD_CLOSE} onClick={requestClose}>
            <i aria-hidden="true" className="ri-close-line" />
          </button>
        </div>
        {full ? <p className="sheet-note">{WATCH_ADD_FULL}</p> : null}
        {load === "fallback" ? (
          <p className="sheet-note">
            {WATCH_ADD_FAIL}{" "}
            <button type="button" className="sheet-text-btn" onClick={() => setReload((n) => n + 1)}>
              {WATCH_ADD_RETRY}
            </button>
          </p>
        ) : null}
        <div className="sheet-search">
          <label className="sr-only" htmlFor={searchId}>
            {WATCH_ADD_SEARCH}
          </label>
          <div className="field-wrap">
            <i aria-hidden="true" className="field-icon ri-search-line" />
            <input
              ref={searchRef}
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={WATCH_ADD_SEARCH}
              autoComplete="off"
              spellCheck={false}
              className="field font-mono"
            />
          </div>
        </div>
        <ul className="sheet-list">
          {shown.length === 0 ? (
            <li className="sheet-empty">{watchAddListEmpty(query, load)}</li>
          ) : (
            shown.map((token) => {
              const on = isFollowing(token.chain, token.address, followRaw);
              return (
                <li key={`${token.chain}:${token.address}`}>
                  <div className="sheet-row">
                    <span className="flex min-w-0 items-center gap-3">
                      <TokenMark symbol={token.symbol} />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium">{token.symbol}</span>
                        <span className="caption flex items-center gap-1.5 capitalize">
                          <ChainMark chain={token.chain} />
                          {token.chain}
                        </span>
                      </span>
                    </span>
                    {on ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => dropToken(token.chain, token.address, token.symbol)}
                      >
                        {WATCH_REMOVE_SHORT}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={full}
                        onClick={() => addToken(token.chain, token.address, token.symbol, false)}
                      >
                        {WATCH_ADD_ACTION}
                      </button>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
        <form className="sheet-foot" onSubmit={onPaste}>
          <p className="col">{WATCH_ADD_PASTE}</p>
          <div className="sheet-paste">
            <ChainPicker
              value={pasteChoice}
              guess={guess}
              onChange={(next) => {
                setPasteChoice(next);
                setPasteNote(null);
              }}
            />
            <label className="sr-only" htmlFor={pasteId}>
              {PASTE_PLACEHOLDER}
            </label>
            <div className="field-wrap">
              <i aria-hidden="true" className="field-icon ri-search-line" />
              <input
                id={pasteId}
                value={pasteAddress}
                onChange={(event) => {
                  setPasteAddress(event.target.value);
                  setPasteNote(null);
                }}
                placeholder={PASTE_PLACEHOLDER}
                autoComplete="off"
                spellCheck={false}
                disabled={full}
                aria-invalid={pasteMessage ? true : undefined}
                aria-describedby={pasteMessage ? errorId : pasteHint ? errorId : undefined}
                className="field font-mono"
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={full || (Boolean(pasteAddress.trim()) && issue !== "ok")}
            >
              {WATCH_ADD_ACTION}
            </button>
          </div>
          {pasteMessage ? (
            <p id={errorId} role="alert" className="caption text-[var(--ink)]">
              {pasteMessage}
            </p>
          ) : pasteHint ? (
            <p id={errorId} className="caption">
              {pasteHint}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
