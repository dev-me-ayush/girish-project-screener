import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export async function GET(req: NextRequest) {
  try {
    if (!isCronAuthorized(req)) {
      const sessionEmail = await getSessionEmail();
      if (!sessionEmail) return unauthorizedResponse();
    }
    const todayStr = istToday();

    // 1. Find and update all expired option items
    const updated = await sql`
      UPDATE watchlist_items
      SET is_expired = TRUE
      WHERE expiry_date < ${todayStr}::date AND is_expired = FALSE
      RETURNING id, symbol, expiry_date;
    `;

    // 2. Refresh Default Options Watchlist with new active nearest expiry.
    // Per-user sync lives in POST /api/watchlists/default-options/sync;
    // the unattended cron has no user context, so it only expires contracts.
    const optionsSync = { skipped: "per-user sync via default-options/sync endpoint" };

    return NextResponse.json({
      status: "success",
      message: "Daily maintenance completed",
      expiredCount: updated.length,
      expiredItems: updated,
      optionsSync,
    });
  } catch (err: unknown) {
    return serverError("Maintenance failed", err);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
