import type { NextRequest } from "next/server";

/**
 * Scheduler authentication for cron / daemon routes.
 * When CRON_SECRET is configured, callers must send
 * `Authorization: Bearer <CRON_SECRET>`. When it is not configured the
 * route falls back to the signed-in session cookie (checked by callers) and
 * logs a warning so the missing secret is noticed.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("CRON_SECRET is not configured; cron route auth falls back to session cookie.");
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
