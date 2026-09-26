import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { hoursUntilReset, SavedReads } from "@/components/SavedReads";
import { WalletClient } from "@/components/WalletClient";
import {
  HOME_AGAIN,
  WALLET_BAD_HEAD,
  WALLET_EMPTY_HEAD,
  WALLET_EMPTY_LINE,
  WALLET_INVALID,
  missingCopy,
  missingKindFromCode,
  outOfCreditsLine,
} from "@/lib/copy";
import { truncateAddress } from "@/lib/format";
import { allowRequest, clientKeyFromHeaders } from "@/lib/rate-limit";
import { resolveWallet } from "@/lib/resolve-check";
import { sanitizeAddress } from "@/lib/sanitize";
import { savedParamSchema, walletParamsSchema } from "@/lib/validate";

type PageProps = {
  params: Promise<{ kind: string; address: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function WalletPage({ params, searchParams }: PageProps) {
  const raw = await params;
  const saved = savedParamSchema.safeParse((await searchParams).saved).success;
  const parsed = walletParamsSchema.safeParse({ kind: raw.kind, address: raw.address });
  const label = truncateAddress(sanitizeAddress(raw.address));
  if (!parsed.success) {
    return <Missing label={label} title={WALLET_BAD_HEAD} reason={WALLET_INVALID} />;
  }

  const headerList = await headers();
  const client = clientKeyFromHeaders(headerList);
  if (!allowRequest(`wallet:${client}`)) {
    const copy = missingCopy("rate");
    return <Missing label={label} title={copy.title} reason={copy.reason} />;
  }

  const result = await resolveWallet(parsed.data.kind, parsed.data.address, { client, saved });
  if (!result.ok) {
    const kind = missingKindFromCode(result.error.code);
    const copy = missingCopy(kind);
    const reason = kind === "credits" ? outOfCreditsLine(hoursUntilReset()) : result.error.message;
    return (
      <Missing label={label} title={copy.title} reason={reason}>
        {kind === "credits" || kind === "not-saved" ? <SavedReads /> : null}
      </Missing>
    );
  }
  if (result.data.rows.length === 0) {
    return <Missing label={label} title={WALLET_EMPTY_HEAD} reason={WALLET_EMPTY_LINE} />;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6">
      <WalletClient wallet={result.data} />
    </main>
  );
}

function Missing({
  label,
  title,
  reason,
  children,
}: {
  label: string;
  title: string;
  reason: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6">
      <p className="caption">
        Bagcheck · <span className="font-mono">{label}</span>
      </p>
      <h1 className="display mt-4 max-w-[16ch]">{title}</h1>
      <p className="caption mt-4 max-w-md">{reason}</p>
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
