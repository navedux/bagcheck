import "server-only";

import { z } from "zod";
import { isTrustedNansenUrl } from "./nansen-schema";

function blank(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

/**
 * Live is allowed on Vercel when DATA_MODE=live. The daily cap and
 * per-IP limiter still apply. Sim and snapshot pass through unchanged.
 */
export function clampDataMode(
  mode: "snapshot" | "sim" | "live",
  onVercel: boolean,
): "snapshot" | "sim" | "live" {
  void onVercel;
  return mode;
}

export function nansenBaseAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/$/, "") || "/";
    return isTrustedNansenUrl(value) && path === "/api/v1";
  } catch {
    return false;
  }
}

const schema = z.object({
  DATA_MODE: z.enum(["snapshot", "sim", "live"]).default("sim"),
  NANSEN_API_KEY: z.string().optional(),
  NANSEN_BASE_URL: z
    .string()
    .url()
    .refine(nansenBaseAllowed, "nansen_base_host")
    .default("https://api.nansen.ai/api/v1"),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
  DAILY_CALL_CAP: z.coerce.number().int().positive().default(400),
  COLD_CHECKS_PER_CLIENT_HOUR: z.coerce.number().int().positive().default(10),
  COLD_CHECKS_PER_HOUR: z.coerce.number().int().positive().default(60),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
});

function loadEnv() {
  const parsed = schema.safeParse({
    DATA_MODE: blank(process.env.DATA_MODE) ?? "sim",
    NANSEN_API_KEY: blank(process.env.NANSEN_API_KEY),
    NANSEN_BASE_URL: blank(process.env.NANSEN_BASE_URL),
    CACHE_TTL_SECONDS: blank(process.env.CACHE_TTL_SECONDS) ?? 900,
    RATE_LIMIT_PER_MIN: blank(process.env.RATE_LIMIT_PER_MIN) ?? 30,
    DAILY_CALL_CAP: blank(process.env.DAILY_CALL_CAP) ?? 400,
    COLD_CHECKS_PER_CLIENT_HOUR: blank(process.env.COLD_CHECKS_PER_CLIENT_HOUR) ?? 10,
    COLD_CHECKS_PER_HOUR: blank(process.env.COLD_CHECKS_PER_HOUR) ?? 60,
    ALLOWED_ORIGINS: blank(process.env.ALLOWED_ORIGINS),
  });

  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join(".") || "(root)")
      .join(", ");
    throw new Error(`Invalid environment: ${fields}`);
  }

  return {
    ...parsed.data,
    DATA_MODE: clampDataMode(parsed.data.DATA_MODE, Boolean(process.env.VERCEL)),
  };
}

export type Env = z.infer<typeof schema>;

export const env = loadEnv();

/** Vercel sets VERCEL=1; only then are its forwarding headers trustworthy. */
export const ON_VERCEL = Boolean(process.env.VERCEL);

export function isLiveMode(current: Env = env): boolean {
  return current.DATA_MODE === "live" && Boolean(current.NANSEN_API_KEY);
}

export function dataMode(current: Env = env): "live" | "sim" | "snapshot" {
  if (current.DATA_MODE === "live") {
    return current.NANSEN_API_KEY ? "live" : "snapshot";
  }
  return current.DATA_MODE;
}

export function modeLabel(current: Env = env): "live" | "sim" | "snapshot" {
  return dataMode(current);
}
