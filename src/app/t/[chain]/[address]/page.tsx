import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckClient } from "@/components/CheckClient";
import { hoursUntilReset, SavedReads } from "@/components/SavedReads";
import {
  HOME_AGAIN,
  missingCopy,
  missingKindFromCode,
  outOfCreditsLine,
  type MissingKind,
} from "@/lib/copy";
import { truncateAddress } from "@/lib/format";
import { allowRequest, clientKeyFromHeaders } from "@/lib/rate-limit";
import { resolveCheck } from "@/lib/resolve-check";
import { sanitizeAddress } from "@/lib/sanitize";
import { CHAINS, type Chain } from "@/lib/types";
import { addressSchema, entryDateSchema, normalizeAddress, savedParamSchema } from "@/lib/validate";

/** Crawlers are kept off by robots.txt (each visit can spend credits); this covers any that ignore it. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

type PageProps = {
  params: Promise<{ chain: string; address: string }>;
  searchParams: Promise<{ entryDate?: string; saved?: string }>;
};

function labelOf(value: string): string {
  return truncateAddress(sanitizeAddress(value));
}

export default async function CheckPage({ params, searchParams }: PageProps) {
  const { chain, address } = await params;
  const query = await searchParams;
  const parsedChain = CHAINS.find((item): item is Chain => item === chain);
  if (!parsedChain) {
    return <Missing tokenLabel={labelOf(address)} kind="chain" />;
  }

  const parsedAddress = addressSchema.safeParse(address);
  if (!parsedAddress.success) {
    return <Missing tokenLabel={labelOf(address)} kind="address" />;
  }

  const headerList = await headers();
  const client = clientKeyFromHeaders(headerList);
  if (!allowRequest(`check:${client}`)) {
    return (
      <Missing
        tokenLabel={truncateAddress(normalizeAddress(parsedAddress.data))}
        kind="rate"
      />
    );
  }

  const entryParsed = entryDateSchema.safeParse(query.entryDate);
  const entryDate = entryParsed.success ? entryParsed.data : undefined;
  const saved = savedParamSchema.safeParse(query.saved).success;
  const result = await resolveCheck(
    parsedChain,
    normalizeAddress(parsedAddress.data),
    entryDate,
    { client, saved },
  );

  if (!result.ok) {
    const kind = missingKindFromCode(result.error.code);
    const offerSaved = kind === "credits" || kind === "not-saved";
    return (
      <Missing
        tokenLabel={truncateAddress(normalizeAddress(parsedAddress.data))}
        kind={kind}
        reason={kind === "credits" ? outOfCreditsLine(hoursUntilReset()) : result.error.message}
      >
        {offerSaved ? <SavedReads /> : null}
      </Missing>
    );
  }

  const checked = result.data;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6">
      <CheckClient checked={checked} entryDate={entryDate} />
    </main>
  );
}

function Missing({
  tokenLabel,
  kind,
  reason,
  children,
}: {
  tokenLabel: string;
  kind: MissingKind;
  reason?: string;
  children?: ReactNode;
}) {
  const copy = missingCopy(kind);
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6">
      <p className="caption">
        Bagcheck · <span className="font-mono">{tokenLabel}</span>
      </p>
      <h1 className="display mt-4 max-w-[12ch]">{copy.title}</h1>
      <p className="caption mt-4 max-w-md">{reason ?? copy.reason}</p>
      {children}
      <p className="mt-8">
        <Link
          href="/"
          className="caption text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4"
        >
          {HOME_AGAIN}
        </Link>
      </p>
    </main>
  );
}
