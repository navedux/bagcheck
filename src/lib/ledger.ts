import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LedgerEntry = {
  path: string;
  timestamp: string;
  httpStatus: number | null;
  cacheHit: boolean;
  creditsQuoted: number;
  creditsUsed: number | null;
  requestId: string | null;
  outcome: string;
};

export class Ledger {
  readonly entries: LedgerEntry[] = [];
  /** Writes are read-modify-write, so they run one at a time. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly writeFile: boolean,
    private readonly filePath = path.join(process.cwd(), "data", "call-log.json"),
  ) {}

  append(entry: LedgerEntry): Promise<void> {
    this.entries.push(entry);
    if (this.entries.length > 5_000) this.entries.splice(0, this.entries.length - 5_000);
    if (!this.writeFile) return Promise.resolve();
    this.queue = this.queue.then(() => this.persist(entry));
    return this.queue;
  }

  private async persist(entry: LedgerEntry): Promise<void> {
    try {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      let existing: LedgerEntry[] = [];
      try {
        const parsed: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
        if (Array.isArray(parsed)) existing = parsed as LedgerEntry[];
      } catch {
        existing = [];
      }
      existing.push(entry);
      await writeFile(this.filePath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
    } catch {
      // Read-only runtimes must not fail the check.
    }
  }
}
