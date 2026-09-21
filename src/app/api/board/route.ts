import { dataMode, env } from "@/lib/env";
import { API_HEADERS } from "@/lib/headers";
import { rejectIfGuarded } from "@/lib/origin";
import { listBoard } from "@/lib/resolve-check";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  void env.DATA_MODE;
  const blocked = rejectIfGuarded(request, "board");
  if (blocked) return blocked;
  const rows = await listBoard();
  return Response.json(
    { ok: true, data: { mode: dataMode(), rows } },
    { headers: API_HEADERS },
  );
}
