import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { cookies } from "next/headers";
import { ensureDefaultOptionsWatchlistSynced, DEFAULT_OPTIONS_WATCHLIST_NAME } from "@/lib/options-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionEmail = cookieStore.get("session_user")?.value || "girishsir@my.app.com";

    // Ensure the default options watchlist is synced for today's active session
    await ensureDefaultOptionsWatchlistSynced(sessionEmail);

    const watchlists = await sql`
      SELECT 
        w.id,
        w.name,
        w.description,
        w.timeframe,
        w.is_scanning_active,
        w.last_scanned_at,
        w.created_at,
        w.updated_at,
        COUNT(i.id)::int AS item_count,
        COUNT(CASE WHEN i.is_expired = TRUE THEN 1 END)::int AS expired_count
      FROM watchlists w
      LEFT JOIN watchlist_items i ON w.id = i.watchlist_id
      WHERE w.user_email = ${sessionEmail} OR w.user_email = 'girishsir@my.app.com'
      GROUP BY w.id
      ORDER BY 
        CASE WHEN w.name = ${DEFAULT_OPTIONS_WATCHLIST_NAME} THEN 0 ELSE 1 END,
        w.created_at ASC;
    `;

    return NextResponse.json({ status: "success", watchlists });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load watchlists";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionEmail = cookieStore.get("session_user")?.value || "girishsir@my.app.com";
    const body = await req.json();
    const { name, description, timeframe = "1m" } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ status: "error", message: "Watchlist name is required" }, { status: 400 });
    }

    // Enforce max 10 watchlists constraint (excluding the system default options watchlist)
    const countResult = await sql`
      SELECT COUNT(*)::int AS count 
      FROM watchlists 
      WHERE (user_email = ${sessionEmail} OR user_email = 'girishsir@my.app.com')
        AND name != ${DEFAULT_OPTIONS_WATCHLIST_NAME};
    `;
    const currentCount = countResult[0]?.count || 0;
    if (currentCount >= 10) {
      return NextResponse.json(
        {
          status: "error",
          message: "Maximum limit of 10 watchlists reached. Delete an existing watchlist to create a new one.",
        },
        { status: 400 }
      );
    }

    const inserted = await sql`
      INSERT INTO watchlists (user_email, name, description, timeframe, is_scanning_active)
      VALUES (${sessionEmail}, ${name.trim()}, ${description || ""}, ${timeframe}, FALSE)
      RETURNING id, name, description, timeframe, is_scanning_active, created_at;
    `;

    return NextResponse.json({ status: "success", watchlist: inserted[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create watchlist";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
