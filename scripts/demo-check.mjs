/**
 * Pre-recording check: prints today's live answer for every featured token
 * and the sample wallet headline, and warms the cache so every click in the
 * recording is instant. Run against your local live server:
 *
 *   pnpm demo-check            (defaults to http://localhost:3000)
 *   DEMO_BASE=http://localhost:3100 pnpm demo-check
 */
const base = process.env.DEMO_BASE ?? "http://localhost:3000";
const SAMPLE = "/w/evm/0xfbeedcfe378866dab6abbafd8b2986f5c1768737";
const LABEL = {
  "still-bid": "Still buying   (Looks good / Hold)",
  distribution: "Cashing out    (Stay away / Time to go)",
  "retail-pump": "Retail rush    (Wait / Hold)",
  split: "Mixed          (Wait / Wait)",
  quiet: "Quiet          (Wait / Hold)",
  "too-thin": "Too small      (Can't tell)",
};

const featured = await fetch(`${base}/api/featured`).then((r) => r.json());
const items = (featured.data ?? []).map((row) => ({ chain: row.chain, address: row.address }));
const watch = await fetch(`${base}/api/watch`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ items }),
}).then((r) => r.json());

console.log(`Live answers from ${base}\n`);
for (const row of watch.data ?? []) {
  const flag = row.stale ? "  (saved, not live)" : "";
  console.log(`${row.symbol.padEnd(7)}${row.chain.padEnd(10)}${LABEL[row.verdict] ?? row.verdict}${flag}`);
}

const page = await fetch(`${base}${SAMPLE}`).then((r) => r.text());
const headline = page.match(
  /(All \d+ of|\d+ of|None of) your \d+ biggest bags? (is|are) cashing out|Your biggest bag is(n.t)? cashing out/,
);
console.log(`\nSample wallet: ${headline ? headline[0].replace("&#x27;", "'") : "no headline (check the page)"}`);

const starters = ["SOL", "PEPE", "BONK"];
const out = (watch.data ?? []).filter((row) => row.verdict === "distribution").map((row) => row.symbol);
console.log(`\nCashing out right now: ${out.length ? out.join(", ") : "none"}`);
const pick = starters.find((s) => out.includes(s)) ?? out[0];
console.log(pick ? `Use ${pick} for the "Stay away" shot.` : "No token is cashing out: use the Wait/Hold shots only.");
