import {
  ATTRIBUTION_HREF,
  ATTRIBUTION_LABEL,
  MODE_CREDIT,
  MODE_PREFIX,
} from "@/lib/copy";

export function Attribution({ mode }: { mode?: "live" | "sim" | "snapshot" }) {
  return (
    <p className="caption">
      {mode ? <span>{MODE_PREFIX[mode]} · </span> : null}
      <a
        href={ATTRIBUTION_HREF}
        className="text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
      >
        {mode ? MODE_CREDIT[mode] : ATTRIBUTION_LABEL}
      </a>
      {". Descriptive onchain data, not financial advice."}
    </p>
  );
}
