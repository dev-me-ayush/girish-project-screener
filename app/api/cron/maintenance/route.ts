import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // Find and update all expired option items
    const updated = await sql`
      UPDATE watchlist_items
      SET is_expired = TRUE
      WHERE expiry_date < ${todayStr}::date AND is_expired = FALSE
      RETURNING id, symbol, expiry_date;
    `;

    return NextResponse.json({
      status: "success",
      message: "Daily maintenance completed",
      expiredCount: updated.length,
      expiredItems: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Maintenance failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
