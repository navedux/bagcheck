import { env } from "@/lib/env";
import { ok } from "@/lib/envelope";
import { API_HEADERS } from "@/lib/headers";
import { rejectIfGuarded } from "@/lib/origin";
import { listFeaturedChecked } from "@/lib/resolve-check";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  void env.DATA_MODE;
  const blocked = rejectIfGuarded(request, "featured");
  if (blocked) return blocked;
  const data = await listFeaturedChecked();
  return Response.json(ok(data), {
    headers: API_HEADERS,
  });
}
