import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

function parseLimit(raw: string | null): number {
  const parsed = parseInt(raw || "50", 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, parsed));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get("limit"));

    const userEmail = await getSessionEmail();
    if (!userEmail) return unauthorizedResponse();

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
    return serverError("Load alerts error", err);
  }
}
