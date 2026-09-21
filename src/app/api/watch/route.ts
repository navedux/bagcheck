import { env } from "@/lib/env";
import { err, ok } from "@/lib/envelope";
import { API_HEADERS } from "@/lib/headers";
import { rejectIfGuarded } from "@/lib/origin";
import { resolveCheck } from "@/lib/resolve-check";
import type { WatchRow } from "@/lib/types";
import { normalizeAddress, watchBodySchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  void env.DATA_MODE;
  const blocked = rejectIfGuarded(request, "watch");
  if (blocked) return blocked;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = watchBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(err("invalid_body", "Send up to 20 followed tokens."), {
      status: 400,
      headers: API_HEADERS,
    });
  }

  const results = await Promise.all(
    parsed.data.items.map((item) =>
      resolveCheck(item.chain, normalizeAddress(item.address)),
    ),
  );
  const rows: WatchRow[] = results.flatMap((result) => {
    if (!result.ok) return [];
    const { chain, address, symbol, verdict, stale, history, stats } = result.data;
    return [
      {
        chain,
        address,
        symbol,
        verdict,
        stale,
        history,
        volumeUsd: stats.volume24hUsd,
      },
    ];
  });

  return Response.json(ok(rows), {
    headers: API_HEADERS,
  });
}
