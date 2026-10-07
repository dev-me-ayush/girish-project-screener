import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getQuotesAndOI } from "@/lib/upstox";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

async function getOwnedWatchlist(id: string, ownerEmail: string) {
  const rows = await sql`
    SELECT id, name, description, is_scanning_active, timeframe, last_scanned_at, created_at, updated_at
    FROM watchlists
    WHERE id = ${id} AND user_email = ${ownerEmail}
    LIMIT 1;
  `;
  return rows[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();
    const { id } = await params;

    const watchlist = await getOwnedWatchlist(id, sessionEmail);

    if (!watchlist) {
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
      watchlist,
      items,
      quotes,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return serverError("Fetch watchlist error", err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
    }
    const { name, description, is_scanning_active, timeframe } = (body || {}) as Record<string, unknown>;

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100)) {
      return NextResponse.json({ status: "error", message: "Invalid watchlist name" }, { status: 400 });
    }
    if (description !== undefined && typeof description !== "string") {
      return NextResponse.json({ status: "error", message: "Invalid description" }, { status: 400 });
    }
    if (timeframe !== undefined && (typeof timeframe !== "string" || !["1m", "2m", "3m", "5m", "15m"].includes(timeframe))) {
      return NextResponse.json({ status: "error", message: "Invalid timeframe" }, { status: 400 });
    }

    const updated = await sql`
      UPDATE watchlists
      SET 
        name = COALESCE(${typeof name === "string" ? name.trim() : null}, name),
        description = COALESCE(${typeof description === "string" ? description.slice(0, 500) : null}, description),
        is_scanning_active = COALESCE(${typeof is_scanning_active === "boolean" ? is_scanning_active : null}, is_scanning_active),
        timeframe = COALESCE(${typeof timeframe === "string" ? timeframe : null}, timeframe),
        updated_at = NOW()
      WHERE id = ${id} AND user_email = ${sessionEmail}
      RETURNING id, name, description, is_scanning_active, timeframe, last_scanned_at, updated_at;
    `;

    if (updated.length === 0) {
      return NextResponse.json({ status: "error", message: "Watchlist not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", watchlist: updated[0] });
  } catch (err: unknown) {
    return serverError("Update watchlist error", err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();
    const { id } = await params;

    const deleted = await sql`
      DELETE FROM watchlists
      WHERE id = ${id} AND user_email = ${sessionEmail}
      RETURNING id;
    `;

    if (deleted.length === 0) {
      return NextResponse.json({ status: "error", message: "Watchlist not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", message: "Watchlist deleted" });
  } catch (err: unknown) {
    return serverError("Delete watchlist error", err);
  }
}
