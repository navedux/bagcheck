import { headers } from "next/headers";
import Link from "next/link";
import { WalletClient } from "@/components/WalletClient";
import {
  HOME_AGAIN,
  WALLET_BAD_HEAD,
  WALLET_EMPTY_HEAD,
  WALLET_EMPTY_LINE,
  WALLET_INVALID,
  missingCopy,
  missingKindFromCode,
} from "@/lib/copy";
import { truncateAddress } from "@/lib/format";
import { allowRequest, clientKeyFromHeaders } from "@/lib/rate-limit";
import { resolveWallet } from "@/lib/resolve-check";
import { sanitizeAddress } from "@/lib/sanitize";
import { walletParamsSchema } from "@/lib/validate";

type PageProps = {
  params: Promise<{ kind: string; address: string }>;
};

export default async function WalletPage({ params }: PageProps) {
  const raw = await params;
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

  const result = await resolveWallet(parsed.data.kind, parsed.data.address, { client });
  if (!result.ok) {
    const copy = missingCopy(missingKindFromCode(result.error.code));
    return <Missing label={label} title={copy.title} reason={result.error.message} />;
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

function Missing({ label, title, reason }: { label: string; title: string; reason: string }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-6">
      <p className="caption">
        Bagcheck · <span className="font-mono">{label}</span>
      </p>
      <h1 className="display mt-4 max-w-[16ch]">{title}</h1>
      <p className="caption mt-4 max-w-md">{reason}</p>
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
