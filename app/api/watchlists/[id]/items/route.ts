import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getIndexOptionChain, SUPPORTED_INDICES, getQuotesAndOI } from "@/lib/upstox";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watchlistId } = await params;
    const body = await req.json();
    const {
      symbol,
      instrumentKey,
      instrumentType,
      strikePrice,
      optionType,
      expiryDate,
      underlyingKey,
      timeframe = "1m",
    } = body;

    if (!symbol || !instrumentKey || !instrumentType) {
      return NextResponse.json(
        { status: "error", message: "Symbol, instrumentKey, and instrumentType are required" },
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
    const tf = validTimeframes.includes(timeframe) ? timeframe : "1m";

    const inserted = await sql`
      INSERT INTO watchlist_items (
        watchlist_id, symbol, instrument_key, instrument_type,
        strike_price, option_type, expiry_date, timeframe, is_active, is_expired
      ) VALUES (
        ${watchlistId}, ${symbol.trim()}, ${instrumentKey}, ${instrumentType},
        ${strikePrice ? Number(strikePrice) : null}, ${optionType || null},
        ${expiryDate || null}, ${tf}, TRUE, FALSE
      )
      RETURNING id, watchlist_id, symbol, instrument_key, instrument_type, strike_price, option_type, expiry_date, timeframe, is_active, is_expired, added_at;
    `;

    // Immediately fetch live quote for this instrument from Upstox
    const quotes = await getQuotesAndOI([instrumentKey]);
    const liveQuote =
      quotes[instrumentKey] ||
      quotes[instrumentKey.replace(":", "|")] ||
      quotes[instrumentKey.replace("|", ":")] ||
      quotes[symbol.trim()] ||
      quotes[`NSE_EQ:${symbol.trim()}`] ||
      quotes[`NSE_EQ|${symbol.trim()}`] ||
      null;

    return NextResponse.json({
      status: "success",
      item: inserted[0],
      quote: liveQuote,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add item to watchlist";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watchlistId } = await params;
    const body = await req.json();
    const { itemId, timeframe, isActive } = body;

    if (!itemId) {
      return NextResponse.json({ status: "error", message: "itemId is required" }, { status: 400 });
    }

    const validTimeframes = ["1m", "2m", "3m", "5m", "15m"];
    const tf = timeframe && validTimeframes.includes(timeframe) ? timeframe : null;

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
    const message = err instanceof Error ? err.message : "Failed to update item";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watchlistId } = await params;
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

    await sql`
      DELETE FROM watchlist_items
      WHERE id = ${itemId} AND watchlist_id = ${watchlistId};
    `;

    return NextResponse.json({ status: "success", message: "Item removed from watchlist" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove item";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
