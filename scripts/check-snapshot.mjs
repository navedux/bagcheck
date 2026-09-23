import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanDirs = [path.join(root, "data")];

const forbidden = [
  "smart-money/",
  "profiler/address/labels",
  "tgm/pnl-leaderboard",
  "perp-leaderboard",
  "premium_labels",
  "include_smart_money_labels",
  "NEXT_PUBLIC_NANSEN",
  "address_label",
  "first_funder_name",
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const hits = [];
for (const dir of scanDirs) {
  const files = await walk(dir);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const needle of forbidden) {
      if (text.includes(needle)) {
        hits.push(`${path.relative(root, file)}: ${needle}`);
      }
    }
  }
}

if (hits.length > 0) {
  console.error("check-snapshot failed:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log("check-snapshot ok: no prohibited paths or public Nansen keys.");
