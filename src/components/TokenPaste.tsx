"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChainPicker } from "@/components/ChainPicker";
import { type ChainChoice } from "@/lib/types";
import {
  PASTE_PENDING,
  PASTE_SUBMIT,
  PASTE_PLACEHOLDER,
  pasteAutoLine,
  pasteLine,
} from "@/lib/copy";
import {
  detectChain,
  normalizeAddress,
  pasteIssueFor,
  pasteShownIssue,
  resolvePasteChain,
} from "@/lib/validate";
import { staticCatalog } from "@/lib/watch-search";

export function TokenPaste({ autoFocus = true }: { autoFocus?: boolean }) {
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
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
      <div className="compose">
        <ChainPicker value={choice} onChange={setChoice} guess={guess} />
        <label className="sr-only" htmlFor={addressId}>
          {PASTE_PLACEHOLDER}
        </label>
        <div className="field-wrap">
          <i aria-hidden="true" className="field-icon ri-search-line" />
          <input
            ref={inputRef}
            id={addressId}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={PASTE_PLACEHOLDER}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : autoHint ? hintId : undefined}
            className="field font-mono"
          />
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || (Boolean(address.trim()) && issue !== "ok")}
          aria-busy={pending}
        >
          {pending ? PASTE_PENDING : PASTE_SUBMIT}
          <i aria-hidden="true" className="ri-arrow-right-s-line text-[15px]" />
        </button>
      </div>
      {message ? (
        <p id={errorId} role="alert" className="caption text-[var(--ink)]">
          {message}
        </p>
      ) : autoHint ? (
        <p id={hintId} className="caption">
          {autoHint}
        </p>
      ) : null}
    </form>
  );
}
