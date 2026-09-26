import { z } from "zod";
import { CHAINS, type Chain, type ChainChoice } from "./types";

const EVM = /^0x[a-fA-F0-9]{40}$/i;
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const chainSchema = z.enum(CHAINS);

export const addressSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => EVM.test(value) || SOL.test(value), {
    message: "invalid_address",
  });

export const entryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const min = new Date(
      Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), now.getUTCDate()),
    );
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    return date <= today && date >= min;
  }, "entry_date_out_of_range");

export const checkQuerySchema = z
  .object({
    chain: chainSchema,
    address: addressSchema,
    entryDate: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      entryDateSchema.optional(),
    ),
  })
  .strict();

export type CheckQuery = z.infer<typeof checkQuerySchema>;

export const FOLLOW_LIMIT = 20;

export const followItemSchema = z
  .object({
    chain: chainSchema,
    address: addressSchema,
    symbol: z.string().min(1).max(24),
  })
  .strict();

export const watchBodySchema = z
  .object({
    items: z
      .array(z.object({ chain: chainSchema, address: addressSchema }).strict())
      .min(1)
      .max(FOLLOW_LIMIT),
  })
  .strict();

export type WatchBody = z.infer<typeof watchBodySchema>;

export const verdictSchema = z.enum([
  "too-thin",
  "still-bid",
  "retail-pump",
  "distribution",
  "split",
  "quiet",
]);

export const watchRowSchema = z
  .object({
    chain: chainSchema,
    address: addressSchema,
    symbol: z.string().min(1).max(24),
    verdict: verdictSchema,
    stale: z.boolean(),
    volumeUsd: z.number().nullable(),
    history: z
      .array(
        z
          .object({
            day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            verdict: verdictSchema,
          })
          .strict(),
      )
      .max(90),
  })
  .strict();

export const watchOkSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(watchRowSchema).max(FOLLOW_LIMIT),
    stale: z.boolean().optional(),
  })
  .strict();

export function utcDayBounds(now = new Date()): { min: string; max: string } {
  const max = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const min = new Date(
    Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), now.getUTCDate()),
  );
  return {
    min: min.toISOString().slice(0, 10),
    max: max.toISOString().slice(0, 10),
  };
}

export function normalizeAddress(address: string): string {
  return /^0x/i.test(address) ? address.toLowerCase() : address;
}

export type AddressKind =
  | "empty"
  | "evm"
  | "solana"
  | "evm-partial"
  | "sol-partial"
  | "invalid"
  | "too-long";

export type PasteIssue =
  | "empty"
  | "incomplete"
  | "invalid"
  | "too-long"
  | "need-0x"
  | "chain-evm"
  | "chain-solana"
  | "ok";

export function classifyAddress(raw: string): AddressKind {
  const value = raw.trim();
  if (!value) return "empty";
  if (value.length > 64) return "too-long";
  if (/^0x/i.test(value)) {
    if (EVM.test(value)) return "evm";
    if (value.length > 42) return "too-long";
    if (/^0x[a-fA-F0-9]*$/i.test(value)) return "evm-partial";
    return "invalid";
  }
  if (SOL.test(value)) return "solana";
  if (value.length > 44) return "too-long";
  if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) return "sol-partial";
  return "invalid";
}

export type ChainGuess = {
  chain: Chain;
  fromCatalog: boolean;
};

/**
 * Auto reads the family from the address. Solana is unique. A complete 0x
 * address is Ethereum or Base: a catalog hit picks the row, otherwise Ethereum.
 */
export function detectChain(
  raw: string,
  known: readonly { chain: Chain; address: string }[] = [],
): ChainGuess | null {
  const kind = classifyAddress(raw);
  if (kind === "solana") return { chain: "solana", fromCatalog: false };
  if (kind !== "evm") return null;
  const addr = normalizeAddress(raw);
  const hit = known.find(
    (row) => row.chain !== "solana" && normalizeAddress(row.address) === addr,
  );
  if (hit) return { chain: hit.chain, fromCatalog: true };
  return { chain: "ethereum", fromCatalog: false };
}

export function resolvePasteChain(
  choice: ChainChoice,
  raw: string,
  known: readonly { chain: Chain; address: string }[] = [],
): Chain | null {
  if (choice !== "auto") return choice;
  return detectChain(raw, known)?.chain ?? null;
}

export function pasteIssueFor(choice: ChainChoice, raw: string): PasteIssue {
  if (choice !== "auto") return pasteIssue(choice, raw);
  const kind = classifyAddress(raw);
  if (kind === "empty") return "empty";
  if (kind === "invalid") return "invalid";
  if (kind === "too-long") return "too-long";
  if (kind === "solana" || kind === "evm") return "ok";
  return "incomplete";
}

export function pasteIssue(
  chain: z.infer<typeof chainSchema>,
  raw: string,
): PasteIssue {
  const kind = classifyAddress(raw);
  if (kind === "empty") return "empty";
  if (kind === "invalid") return "invalid";
  if (kind === "too-long") return "too-long";
  if (chain === "solana") {
    if (kind === "evm" || kind === "evm-partial") return "chain-evm";
    if (kind === "solana") return "ok";
    return "incomplete";
  }
  if (kind === "evm") return "ok";
  if (kind === "evm-partial") return "incomplete";
  if (kind === "solana") return "chain-solana";
  return "need-0x";
}

export type PasteProblem = Exclude<PasteIssue, "ok">;

export function pasteLiveIssue(issue: PasteIssue): PasteProblem | null {
  if (issue === "empty" || issue === "incomplete" || issue === "ok") return null;
  return issue;
}

export function pasteShownIssue(issue: PasteIssue, touched: boolean): PasteProblem | null {
  const live = pasteLiveIssue(issue);
  if (live) return live;
  if (touched && issue !== "ok") return issue;
  return null;
}

export function addressFitsChain(chain: z.infer<typeof chainSchema>, address: string): boolean {
  return pasteIssue(chain, address) === "ok";
}

export const catalogTokenSchema = z.object({
  chain: chainSchema,
  address: addressSchema,
  symbol: z.string().min(1).max(24),
  verdict: verdictSchema,
});

export type CatalogToken = z.infer<typeof catalogTokenSchema>;

export const featuredOkSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(catalogTokenSchema),
    stale: z.boolean().optional(),
  })
  .strict();

export const walletKindSchema = z.enum(["solana", "evm"]);

/** Route params for /w/[kind]/[address]: the address must match its kind. */
export const walletParamsSchema = z
  .object({
    kind: walletKindSchema,
    address: z.string().trim().min(1).max(64),
  })
  .strict()
  .refine(
    (value) => (value.kind === "evm" ? EVM.test(value.address) : SOL.test(value.address)),
    { message: "invalid_wallet" },
  );

export function walletKindFor(raw: string): "solana" | "evm" | null {
  const value = raw.trim();
  if (EVM.test(value)) return "evm";
  if (SOL.test(value)) return "solana";
  return null;
}
