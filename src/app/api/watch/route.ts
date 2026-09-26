import { env } from "@/lib/env";
import { err, ok } from "@/lib/envelope";
import { API_HEADERS } from "@/lib/headers";
import { rejectIfGuarded } from "@/lib/origin";
import { clientKey } from "@/lib/rate-limit";
import { resolveWatchRow } from "@/lib/resolve-check";
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

  // Each cold row spends the caller's hourly budget; warm rows are free.
  // Live rows use the lean read: verdict only, 2 credits instead of 7.
  const client = clientKey(request);
  const results = await Promise.all(
    parsed.data.items.map((item) =>
      resolveWatchRow(item.chain, normalizeAddress(item.address), { client }),
    ),
  );
  const rows: WatchRow[] = results.filter((row): row is WatchRow => row !== null);

  return Response.json(ok(rows), {
    headers: API_HEADERS,
  });
}
