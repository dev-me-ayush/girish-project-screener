import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));

    const cookieStore = await cookies();
    const sessionEmail = cookieStore.get("session_user")?.value || "girishsir@my.app.com";
    const userEmail = searchParams.get("email") || sessionEmail;

    // Single default watchlist: user_pinned_symbols only (pinned from All Stocks).
    // Legacy multi-watchlist tables (watchlists / watchlist_items) are retired
    // and must not contribute to the count or the alert feed.
    const userSymbolsResult = await sql`
      SELECT DISTINCT symbol FROM user_pinned_symbols
      WHERE user_email = ${userEmail};
    `;

    const userSymbols = userSymbolsResult.map((r) => r.symbol as string).filter(Boolean);

    // If user has 0 symbols in their watchlist, return empty alert feed
    if (userSymbols.length === 0) {
      return NextResponse.json({
        status: "success",
        watchlistSymbolsCount: 0,
        count: 0,
        alerts: [],
      });
    }

    // IST calendar day: the engine stamps session_date in IST, while the
    // database clock runs UTC — passing IST explicitly avoids leaking the
    // previous session's rows around midnight UTC.
    const istToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

    // Alerts strictly for the user's watchlist, from today's session only,
    // and only events that fired after the symbol was pinned.
    const alerts = await sql`
      SELECT
        sa.id,
        sa.symbol,
        sa.instrument_key,
        sa.instrument_type,
        sa.timeframe,
        sa.level_name,
        sa.level_price,
        sa.trigger_price,
        sa.direction,
        sa.breach_count,
        sa.session_date,
        sa.breakout_time,
        sa.triggered_at
      FROM scanner_alerts sa
      JOIN user_pinned_symbols ups
        ON ups.symbol = sa.symbol
        AND ups.user_email = ${userEmail}
      WHERE sa.session_date = ${istToday}::DATE
        AND sa.triggered_at >= ups.created_at
      ORDER BY sa.triggered_at DESC
      LIMIT ${limit};
    `;

    return NextResponse.json({
      status: "success",
      watchlistSymbolsCount: userSymbols.length,
      count: alerts.length,
      alerts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load alerts";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
