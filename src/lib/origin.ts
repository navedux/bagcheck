import "server-only";

import { env } from "./env";
import { err } from "./envelope";
import { API_HEADERS } from "./headers";
import { allowRequest, clientKey } from "./rate-limit";

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF / cross-site credit drain: a foreign Origin cannot hit our APIs.
 * Missing Origin (curl, warmup, server-side fetch) is allowed. Same-origin
 * browser calls match Host. ALLOWED_ORIGINS covers explicit extras.
 */
export function allowOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const originUrl = originOf(origin);
  if (!originUrl) return false;
  const host = request.headers.get("host");
  if (host && originOf(`https://${host}`) === originUrl) return true;
  if (host && originOf(`http://${host}`) === originUrl) return true;
  const allowed = env.ALLOWED_ORIGINS.split(",")
    .map((item) => originOf(item.trim()))
    .filter((item): item is string => Boolean(item));
  return allowed.includes(originUrl);
}

export function rejectIfGuarded(request: Request, bucket: string): Response | null {
  if (!allowOrigin(request)) {
    return Response.json(err("forbidden", "Origin not allowed."), {
      status: 403,
      headers: API_HEADERS,
    });
  }
  if (!allowRequest(`${bucket}:${clientKey(request)}`)) {
    return Response.json(err("rate_limited", "Too many requests. Wait a minute."), {
      status: 429,
      headers: API_HEADERS,
    });
  }
  return null;
}
