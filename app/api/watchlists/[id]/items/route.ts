import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getIndexOptionChain, SUPPORTED_INDICES, getQuotesAndOI } from "@/lib/upstox";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

async function isOwnedWatchlist(watchlistId: string, ownerEmail: string): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM watchlists WHERE id = ${watchlistId} AND user_email = ${ownerEmail} LIMIT 1;
  `;
  return rows.length > 0;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();
    const { id: watchlistId } = await params;

    if (!(await isOwnedWatchlist(watchlistId, sessionEmail))) {
      return NextResponse.json({ status: "error", message: "Watchlist not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
    }
    const {
      symbol,
      instrumentKey,
      instrumentType,
      strikePrice,
      optionType,
      expiryDate,
      underlyingKey,
      timeframe = "1m",
    } = (body || {}) as Record<string, unknown>;

    if (typeof symbol !== "string" || !symbol.trim() || symbol.trim().length > 60) {
      return NextResponse.json(
        { status: "error", message: "Valid symbol is required" },
        { status: 400 }
      );
    }
    if (typeof instrumentKey !== "string" || !instrumentKey.trim() || instrumentKey.length > 120) {
      return NextResponse.json(
        { status: "error", message: "Valid instrumentKey is required" },
        { status: 400 }
      );
    }
    if (typeof instrumentType !== "string" || !instrumentType) {
      return NextResponse.json(
        { status: "error", message: "instrumentType is required" },
        { status: 400 }
      );
    }
    if (strikePrice !== undefined && strikePrice !== null && !Number.isFinite(Number(strikePrice))) {
      return NextResponse.json(
        { status: "error", message: "Invalid strikePrice" },
        { status: 400 }
      );
    }

    // Strict validation for options:
    if (instrumentType === "OPTION_CE" || instrumentType === "OPTION_PE") {
      const validUnderlying = SUPPORTED_INDICES.find(
        (i) => i.instrumentKey === underlyingKey || i.symbol === underlyingKey
      );

      if (!validUnderlying) {
        return NextResponse.json(
          {
            status: "error",
            message: "Only index options for NIFTY, BANKNIFTY, and SENSEX are permitted. Stock options are disallowed.",
          },
          { status: 400 }
        );
      }

      // Verify that contract is within ATM +- 7 strikes
      const chain = await getIndexOptionChain(validUnderlying.instrumentKey);
      const isAllowed = chain.options.some((opt) => opt.instrumentKey === instrumentKey);

      if (!isAllowed) {
        return NextResponse.json(
          {
            status: "error",
            message: `Strike price ${strikePrice} is outside the allowed ATM ± 7 strikes range for ${validUnderlying.name}.`,
          },
          { status: 400 }
        );
      }
    }

    // Check if symbol already exists in this watchlist
    const existing = await sql`
      SELECT id FROM watchlist_items
      WHERE watchlist_id = ${watchlistId} AND instrument_key = ${instrumentKey}
      LIMIT 1;
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { status: "error", message: "Symbol is already present in this watchlist" },
        { status: 409 }
      );
    }

    const validTimeframes = ["1m", "2m", "3m", "5m", "15m"];
    const tf = typeof timeframe === "string" && validTimeframes.includes(timeframe) ? timeframe : "1m";

    const inserted = await sql`
      INSERT INTO watchlist_items (
        watchlist_id, symbol, instrument_key, instrument_type,
        strike_price, option_type, expiry_date, timeframe, is_active, is_expired
      ) VALUES (
        ${watchlistId}, ${(symbol as string).trim()}, ${instrumentKey as string}, ${instrumentType as string},
        ${strikePrice ? Number(strikePrice as string) : null}, ${(optionType as string) || null},
        ${(expiryDate as string) || null}, ${tf}, TRUE, FALSE
      )
      RETURNING id, watchlist_id, symbol, instrument_key, instrument_type, strike_price, option_type, expiry_date, timeframe, is_active, is_expired, added_at;
    `;

    // Immediately fetch live quote for this instrument from Upstox
    const quotes = await getQuotesAndOI([instrumentKey as string]);
    const liveQuote =
      quotes[instrumentKey as string] ||
      quotes[(instrumentKey as string).replace(":", "|")] ||
      quotes[(instrumentKey as string).replace("|", ":")] ||
      quotes[(symbol as string).trim()] ||
      quotes[`NSE_EQ:${(symbol as string).trim()}`] ||
      quotes[`NSE_EQ|${(symbol as string).trim()}`] ||
      null;

    return NextResponse.json({
      status: "success",
      item: inserted[0],
      quote: liveQuote,
    });
  } catch (err: unknown) {
    return serverError("Add watchlist item error", err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();
    const { id: watchlistId } = await params;

    if (!(await isOwnedWatchlist(watchlistId, sessionEmail))) {
      return NextResponse.json({ status: "error", message: "Watchlist not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
    }
    const { itemId, timeframe, isActive } = (body || {}) as Record<string, unknown>;

    if (typeof itemId !== "string" || !itemId) {
      return NextResponse.json({ status: "error", message: "itemId is required" }, { status: 400 });
    }

    const validTimeframes = ["1m", "2m", "3m", "5m", "15m"];
    const tf = typeof timeframe === "string" && validTimeframes.includes(timeframe) ? timeframe : null;

    const updated = await sql`
      UPDATE watchlist_items
      SET 
        timeframe = COALESCE(${tf}, timeframe),
        is_active = COALESCE(${typeof isActive === "boolean" ? isActive : null}, is_active)
      WHERE id = ${itemId} AND watchlist_id = ${watchlistId}
      RETURNING id, watchlist_id, symbol, timeframe, is_active;
    `;

    if (updated.length === 0) {
      return NextResponse.json({ status: "error", message: "Watchlist item not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", item: updated[0] });
  } catch (err: unknown) {
    return serverError("Update watchlist item error", err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();
    const { id: watchlistId } = await params;

    if (!(await isOwnedWatchlist(watchlistId, sessionEmail))) {
      return NextResponse.json({ status: "error", message: "Watchlist not found" }, { status: 404 });
    }

    let itemId = req.nextUrl.searchParams.get("itemId");

    if (!itemId) {
      try {
        const body = await req.json();
        itemId = body.itemId;
      } catch {
        // Body was empty or not JSON
      }
    }

    if (!itemId) {
      return NextResponse.json({ status: "error", message: "itemId is required" }, { status: 400 });
    }

    const removed = await sql`
      DELETE FROM watchlist_items
      WHERE id = ${itemId} AND watchlist_id = ${watchlistId}
      RETURNING id;
    `;

    if (removed.length === 0) {
      return NextResponse.json({ status: "error", message: "Watchlist item not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", message: "Item removed from watchlist" });
  } catch (err: unknown) {
    return serverError("Remove watchlist item error", err);
  }
}
