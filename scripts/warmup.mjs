/**
 * Featured refresh loop for a key'd local machine.
 * Does nothing in snapshot mode. Never run this on the public deploy.
 */
const base = process.env.WARMUP_BASE ?? "http://localhost:3000";

const featured = await fetch(`${base}/api/featured`);
if (!featured.ok) {
  console.error(`warmup: featured ${featured.status}`);
  process.exit(1);
}
const body = await featured.json();
const count = Array.isArray(body.data) ? body.data.length : 0;
console.log(`warmup: refreshed ${count} featured tokens from ${base}`);
