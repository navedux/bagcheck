import {
  ATTRIBUTION_HREF,
  ATTRIBUTION_LABEL,
  MODE_CREDIT,
  MODE_PREFIX,
  NOT_ADVICE,
  REFERRAL_NOTE,
} from "@/lib/copy";

export function Attribution({ mode }: { mode?: "live" | "sim" | "snapshot" }) {
  return (
    <p className="caption">
      {mode ? <span>{MODE_PREFIX[mode]} · </span> : null}
      <a
        href={ATTRIBUTION_HREF}
        rel="sponsored"
        className="text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
      >
        {mode ? MODE_CREDIT[mode] : ATTRIBUTION_LABEL}
      </a>
      {` (${REFERRAL_NOTE}). ${NOT_ADVICE}`}
    </p>
  );
}
