import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();

    let equities;
    if (query) {
      const searchPattern = `%${query}%`;
      equities = await sql`
        SELECT id, symbol, name, instrument_key, isin, sector
        FROM stocks
        WHERE symbol ILIKE ${searchPattern}
           OR name ILIKE ${searchPattern}
           OR sector ILIKE ${searchPattern}
        ORDER BY 
          CASE 
            WHEN symbol ILIKE ${query} THEN 1
            WHEN symbol ILIKE ${query + '%'} THEN 2
            ELSE 3 
          END,
          symbol ASC
        LIMIT 60;
      `;
    } else {
      equities = await sql`
        SELECT id, symbol, name, instrument_key, isin, sector
        FROM stocks
        ORDER BY symbol ASC
        LIMIT 60;
      `;
    }

    return NextResponse.json({
      status: "success",
      count: equities.length,
      equities,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to query stocks from database";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
