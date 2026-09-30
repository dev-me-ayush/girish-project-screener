import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  console.log("=== Testing Fibonacci Search & Queries ===");

  // 1. Test empty query (default list)
  const defaultItems = await sql`
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
  console.log(`\n1. Default symbols returned: ${defaultItems.length}`);
  console.log("Sample defaults:", defaultItems.slice(0, 5));

  // 2. Test search for 20MICRONS
  const searchPattern1 = "%MICRON%";
  const query1 = "MICRON";
  const micronSearch = await sql`
    WITH combined AS (
      SELECT 
        symbol, 
        name, 
        instrument_key, 
        COALESCE(sector, 'Equity') as sector,
        1 as priority
      FROM stocks
      WHERE symbol ILIKE ${searchPattern1}
         OR name ILIKE ${searchPattern1}
         OR sector ILIKE ${searchPattern1}
      
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
          symbol ILIKE ${searchPattern1}
          OR COALESCE(instrument_type, '') ILIKE ${searchPattern1}
          OR COALESCE(option_type, '') ILIKE ${searchPattern1}
          OR CAST(strike_price AS TEXT) ILIKE ${searchPattern1}
        )
    )
    SELECT symbol, name, instrument_key, sector
    FROM (
      SELECT DISTINCT ON (instrument_key) symbol, name, instrument_key, sector, priority
      FROM combined
    ) u
    ORDER BY 
      CASE 
        WHEN symbol ILIKE ${query1} THEN 1
        WHEN symbol ILIKE ${query1 + '%'} THEN 2
        ELSE 3 
      END,
      priority ASC,
      symbol ASC
    LIMIT 60;
  `;
  console.log(`\n2. Search 'MICRON' results: ${micronSearch.length}`);
  console.log("Found:", micronSearch);

  // 3. Test search for active options (e.g. NIFTY 22400)
  const searchPattern2 = "%22400%";
  const query2 = "22400";
  const optionSearch = await sql`
    WITH combined AS (
      SELECT 
        symbol, 
        name, 
        instrument_key, 
        COALESCE(sector, 'Equity') as sector,
        1 as priority
      FROM stocks
      WHERE symbol ILIKE ${searchPattern2}
         OR name ILIKE ${searchPattern2}
         OR sector ILIKE ${searchPattern2}
      
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
          symbol ILIKE ${searchPattern2}
          OR COALESCE(instrument_type, '') ILIKE ${searchPattern2}
          OR COALESCE(option_type, '') ILIKE ${searchPattern2}
          OR CAST(strike_price AS TEXT) ILIKE ${searchPattern2}
        )
    )
    SELECT symbol, name, instrument_key, sector
    FROM (
      SELECT DISTINCT ON (instrument_key) symbol, name, instrument_key, sector, priority
      FROM combined
    ) u
    ORDER BY 
      CASE 
        WHEN symbol ILIKE ${query2} THEN 1
        WHEN symbol ILIKE ${query2 + '%'} THEN 2
        ELSE 3 
      END,
      priority ASC,
      symbol ASC
    LIMIT 60;
  `;
  console.log(`\n3. Search '22400' option results: ${optionSearch.length}`);
  console.log("Found:", optionSearch);

  // 4. Test Upstox Range for 20MICRONS
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (token) {
    console.log("\n4. Testing Upstox Historical Daily Range for 20MICRONS...");
    const instrumentKey = "NSE_EQ|INE144J01027";
    const today = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${today}/${fromDate}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const json = await res.json();
      const candles = json.data?.candles || [];
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const todayIST = new Date(Date.now() + istOffsetMs).toISOString().split("T")[0];
      const completedCandles = candles.filter((c) => !c[0].startsWith(todayIST));
      const prevBar = completedCandles.length > 0 ? completedCandles[0] : candles[0];
      if (prevBar) {
        const pdh = Number(prevBar[2]);
        const pdl = Number(prevBar[3]);
        const pdc = Number(prevBar[4]);
        const range = Number(Math.max(0, pdh - pdl).toFixed(2));
        const ac38_2 = Number((pdh - 0.382 * range).toFixed(2));
        const dc38_2 = Number((pdl + 0.382 * range).toFixed(2));
        console.log(`Previous Session Date: ${prevBar[0]}`);
        console.log(`PDH: ${pdh}, PDL: ${pdl}, PDC: ${pdc}, Range: ${range}`);
        console.log(`AC 38.2%: ${ac38_2}, DC 38.2%: ${dc38_2}`);
      }
    }
  }

  console.log("\n=== Test Completed Successfully ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
