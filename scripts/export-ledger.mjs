import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const logPath = path.join(root, "data", "call-log.json");
const outPath = path.join(root, "ledger", "summary.md");

let entries = [];
try {
  const parsed = JSON.parse(await readFile(logPath, "utf8"));
  if (Array.isArray(parsed)) entries = parsed;
} catch {
  entries = [];
}

const billed = entries.filter(
  (row) => row && row.cacheHit === false && typeof row.httpStatus === "number",
);
const byPath = new Map();
for (const row of billed) {
  const key = row.path ?? "unknown";
  byPath.set(key, (byPath.get(key) ?? 0) + 1);
}

const lines = [
  "# Ledger summary",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `- Total log rows: ${entries.length}`,
  `- Non-cache calls: ${billed.length}`,
  `- Cache hits: ${entries.length - billed.length}`,
  "",
  "## By path",
  "",
];

if (byPath.size === 0) {
  lines.push("No outbound calls yet. Public demo stays snapshot-only.");
  lines.push("");
  lines.push(
    "100+ non-cache calls need `DATA_MODE=live` and a key. Run `pnpm warmup` locally after you add the key.",
  );
} else {
  for (const [pathName, count] of [...byPath.entries()].sort()) {
    lines.push(`- \`${pathName}\`: ${count}`);
  }
  if (billed.length < 100) {
    lines.push("");
    lines.push(
      `Need ${100 - billed.length} more non-cache calls for the submission bar.`,
    );
  }
}

lines.push("");

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${path.relative(root, outPath)} (${billed.length} non-cache calls).`);
