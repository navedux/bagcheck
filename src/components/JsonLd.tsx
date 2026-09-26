import { jsonLdText } from "@/lib/structured-data";

/**
 * Structured data for search and answer engines. React writes a script's text
 * child as-is, so this needs no raw-HTML escape hatch; jsonLdText escapes `<`
 * so the payload can never close the tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json">{jsonLdText(data)}</script>;
}
