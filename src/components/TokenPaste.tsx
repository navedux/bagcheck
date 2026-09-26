"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChainPicker } from "@/components/ChainPicker";
import { type ChainChoice } from "@/lib/types";
import {
  PASTE_MODE_LABEL,
  PASTE_MODE_TOKEN,
  PASTE_MODE_WALLET,
  PASTE_PENDING,
  PASTE_SUBMIT,
  PASTE_PLACEHOLDER,
  WALLET_EMPTY,
  WALLET_HINT_EVM,
  WALLET_HINT_SOL,
  WALLET_INVALID,
  WALLET_PLACEHOLDER,
  WALLET_SUBMIT,
  pasteAutoLine,
  pasteLine,
} from "@/lib/copy";
import {
  detectChain,
  normalizeAddress,
  pasteIssueFor,
  pasteShownIssue,
  resolvePasteChain,
  walletKindFor,
} from "@/lib/validate";
import { staticCatalog } from "@/lib/watch-search";
import { track } from "@/lib/analytics";

export type PasteMode = "token" | "wallet";

export function TokenPaste({
  autoFocus = true,
  mode = "token",
  onModeChange,
}: {
  autoFocus?: boolean;
  mode?: PasteMode;
  onModeChange?: (mode: PasteMode) => void;
}) {
  const router = useRouter();
  const addressId = useId();
  const errorId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const known = useMemo(() => staticCatalog(), []);
  const [choice, setChoice] = useState<ChainChoice>("auto");
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const guess = choice === "auto" ? detectChain(address, known) : null;
  const issue = pasteIssueFor(choice, address);
  const shown = pasteShownIssue(issue, touched);
  const message = shown ? pasteLine(shown) : null;
  const autoHint = !message ? pasteAutoLine(choice, guess, issue) : null;
  const chain = resolvePasteChain(choice, address, known);
  const wallet = mode === "wallet";
  const walletKind = walletKindFor(address);
  const walletMessage = !wallet || !touched
    ? null
    : !address.trim()
      ? WALLET_EMPTY
      : walletKind
        ? null
        : WALLET_INVALID;
  const walletHint = wallet && !walletMessage && walletKind
    ? walletKind === "evm" ? WALLET_HINT_EVM : WALLET_HINT_SOL
    : null;
  const shownMessage = wallet ? walletMessage : message;
  const shownHint = wallet ? walletHint : autoHint;

  function switchMode(next: PasteMode) {
    if (next === mode) return;
    setTouched(false);
    onModeChange?.(next);
    inputRef.current?.focus();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (wallet) {
      if (!walletKind) {
        inputRef.current?.focus();
        return;
      }
      setPending(true);
      track("wallet_check_started", { kind: walletKind });
      const value = address.trim();
      router.push(`/w/${walletKind}/${walletKind === "evm" ? value.toLowerCase() : value}`);
      return;
    }
    if (issue !== "ok" || !chain) {
      setPending(false);
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    router.push(`/t/${chain}/${normalizeAddress(address)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      {onModeChange ? (
        <div className="seg self-start" role="group" aria-label={PASTE_MODE_LABEL}>
          <button type="button" aria-pressed={!wallet} onClick={() => switchMode("token")}>
            {PASTE_MODE_TOKEN}
          </button>
          <button type="button" aria-pressed={wallet} onClick={() => switchMode("wallet")}>
            {PASTE_MODE_WALLET}
          </button>
        </div>
      ) : null}
      <div className="compose">
        {wallet ? null : <ChainPicker value={choice} onChange={setChoice} guess={guess} />}
        <label className="sr-only" htmlFor={addressId}>
          {wallet ? WALLET_PLACEHOLDER : PASTE_PLACEHOLDER}
        </label>
        <div className="field-wrap">
          <i aria-hidden="true" className="field-icon ri-search-line" />
          <input
            ref={inputRef}
            id={addressId}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={wallet ? WALLET_PLACEHOLDER : PASTE_PLACEHOLDER}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            aria-invalid={shownMessage ? true : undefined}
            aria-describedby={shownMessage ? errorId : shownHint ? hintId : undefined}
            className="field font-mono"
          />
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || (!wallet && Boolean(address.trim()) && issue !== "ok")}
          aria-busy={pending}
        >
          {pending ? PASTE_PENDING : wallet ? WALLET_SUBMIT : PASTE_SUBMIT}
          <i aria-hidden="true" className="ri-arrow-right-s-line text-[15px]" />
        </button>
      </div>
      {shownMessage ? (
        <p id={errorId} role="alert" className="caption text-[var(--ink)]">
          {shownMessage}
        </p>
      ) : shownHint ? (
        <p id={hintId} className="caption">
          {shownHint}
        </p>
      ) : null}
    </form>
  );
}
