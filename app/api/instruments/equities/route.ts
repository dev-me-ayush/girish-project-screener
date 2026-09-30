import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();

    let items;
    if (query) {
      const searchPattern = `%${query}%`;
      items = await sql`
        WITH combined AS (
          SELECT 
            symbol, 
            name, 
            instrument_key, 
            COALESCE(sector, 'Equity') as sector,
            1 as priority
          FROM stocks
          WHERE symbol ILIKE ${searchPattern}
             OR name ILIKE ${searchPattern}
             OR sector ILIKE ${searchPattern}
          
          UNION ALL

          SELECT DISTINCT ON (instrument_key)
            symbol, 
            symbol as name, 
            instrument_key, 
            COALESCE(instrument_type, 'OPTION') as sector,
            2 as priority
          FROM watchlist_items
          WHERE is_active = true
            AND (
              symbol ILIKE ${searchPattern}
              OR COALESCE(instrument_type, '') ILIKE ${searchPattern}
              OR COALESCE(option_type, '') ILIKE ${searchPattern}
              OR CAST(strike_price AS TEXT) ILIKE ${searchPattern}
            )
        )
        SELECT symbol, name, instrument_key, sector
        FROM (
          SELECT DISTINCT ON (instrument_key) symbol, name, instrument_key, sector, priority
          FROM combined
        ) u
        ORDER BY 
          CASE 
            WHEN symbol ILIKE ${query} THEN 1
            WHEN symbol ILIKE ${query + '%'} THEN 2
            ELSE 3 
          END,
          priority ASC,
          symbol ASC
        LIMIT 60;
      `;
    } else {
      items = await sql`
        WITH default_equities AS (
          SELECT symbol, name, instrument_key, COALESCE(sector, 'Equity') as sector, 1 as priority
          FROM stocks
          WHERE symbol IN ('20MICRONS', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'ITC', 'LT')
        ),
        default_options AS (
          SELECT DISTINCT ON (instrument_key)
            symbol, symbol as name, instrument_key, COALESCE(instrument_type, 'OPTION') as sector, 2 as priority
          FROM watchlist_items
          WHERE is_active = true AND instrument_type LIKE 'OPTION%'
          LIMIT 20
        ),
        combined AS (
          SELECT * FROM default_equities
          UNION ALL
          SELECT * FROM default_options
        )
        SELECT symbol, name, instrument_key, sector
        FROM combined
        ORDER BY priority ASC, symbol ASC
        LIMIT 40;
      `;
    }

    return NextResponse.json({
      status: "success",
      count: items.length,
      stocks: items,
      equities: items,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to query instruments from database";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
