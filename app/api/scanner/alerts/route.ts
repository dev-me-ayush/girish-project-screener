import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));

    const alerts = await sql`
      SELECT 
        id, 
        symbol, 
        instrument_key, 
        instrument_type, 
        timeframe, 
        level_name, 
        level_price, 
        trigger_price, 
        direction, 
        breach_count, 
        session_date, 
        breakout_time, 
        triggered_at
      FROM scanner_alerts
      ORDER BY triggered_at DESC
      LIMIT ${limit};
    `;

    return NextResponse.json({
      status: "success",
      count: alerts.length,
      alerts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load alerts";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
