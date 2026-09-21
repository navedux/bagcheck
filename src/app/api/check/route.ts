import { env } from "@/lib/env";
import { err, ok } from "@/lib/envelope";
import { API_HEADERS } from "@/lib/headers";
import { rejectIfGuarded } from "@/lib/origin";
import { resolveCheck } from "@/lib/resolve-check";
import { checkQuerySchema, normalizeAddress } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  void env.DATA_MODE;
  const blocked = rejectIfGuarded(request, "check");
  if (blocked) return blocked;

  const url = new URL(request.url);
  const parsed = checkQuerySchema.safeParse({
    chain: url.searchParams.get("chain"),
    address: url.searchParams.get("address"),
    entryDate: url.searchParams.get("entryDate"),
  });

  if (!parsed.success) {
    return Response.json(err("invalid_query", "Check the chain and token address."), {
      status: 400,
      headers: API_HEADERS,
    });
  }

  const result = await resolveCheck(
    parsed.data.chain,
    normalizeAddress(parsed.data.address),
    parsed.data.entryDate,
  );

  if (!result.ok) {
    const status =
      result.error.code === "not_in_snapshot" || result.error.code === "not_found"
        ? 404
        : 502;
    return Response.json(err(result.error.code, result.error.message), {
      status,
      headers: API_HEADERS,
    });
  }

  return Response.json(ok(result.data, result.data.stale), {
    headers: API_HEADERS,
  });
}
