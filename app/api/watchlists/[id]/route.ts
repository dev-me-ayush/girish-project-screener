import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getQuotesAndOI } from "@/lib/upstox";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const watchlists = await sql`
      SELECT id, name, description, is_scanning_active, timeframe, last_scanned_at, created_at, updated_at
      FROM watchlists
      WHERE id = ${id}
      LIMIT 1;
    `;

    if (watchlists.length === 0) {
      return NextResponse.json({ status: "error", message: "Watchlist not found" }, { status: 404 });
    }

    const items = await sql`
      SELECT 
        id, 
        watchlist_id, 
        symbol, 
        instrument_key, 
        instrument_type, 
        strike_price, 
        option_type, 
        expiry_date, 
        timeframe,
        is_active,
        is_expired, 
        added_at
      FROM watchlist_items
      WHERE watchlist_id = ${id}
      ORDER BY added_at ASC;
    `;

    const keys = (items as Array<{ instrument_key: string }>).map((i) => i.instrument_key).filter(Boolean);
    const quotes = keys.length > 0 ? await getQuotesAndOI(keys) : {};

    return NextResponse.json({
      status: "success",
      watchlist: watchlists[0],
      items,
      quotes,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch watchlist";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, is_scanning_active, timeframe } = body;

    const updated = await sql`
      UPDATE watchlists
      SET 
        name = COALESCE(${name !== undefined ? name.trim() : null}, name),
        description = COALESCE(${description !== undefined ? description : null}, description),
        is_scanning_active = COALESCE(${typeof is_scanning_active === "boolean" ? is_scanning_active : null}, is_scanning_active),
        timeframe = COALESCE(${timeframe !== undefined ? timeframe.trim() : null}, timeframe),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, description, is_scanning_active, timeframe, last_scanned_at, updated_at;
    `;

    if (updated.length === 0) {
      return NextResponse.json({ status: "error", message: "Watchlist not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", watchlist: updated[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update watchlist";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await sql`
      DELETE FROM watchlists
      WHERE id = ${id};
    `;

    return NextResponse.json({ status: "success", message: "Watchlist deleted" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete watchlist";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
