/**
 * Warm the featured tokens on a key'd local machine: one live check each.
 * Repeat runs inside the cache TTL cost nothing. Never point this at the
 * public deploy.
 */
const base = process.env.WARMUP_BASE ?? "http://localhost:3000";

const featured = await fetch(`${base}/api/featured`);
if (!featured.ok) {
  console.error(`warmup: featured ${featured.status}`);
  process.exit(1);
}
const body = await featured.json();
const rows = Array.isArray(body.data) ? body.data : [];

let ok = 0;
for (const row of rows) {
  const url = `${base}/api/check?chain=${encodeURIComponent(row.chain)}&address=${encodeURIComponent(row.address)}`;
  const response = await fetch(url);
  const json = await response.json().catch(() => ({}));
  const stale = json?.data?.stale ? " (stale)" : "";
  console.log(`warmup: ${row.symbol ?? row.address} ${response.status}${stale}`);
  if (response.ok) ok += 1;
}
console.log(`warmup: ${ok}/${rows.length} featured tokens checked on ${base}`);
