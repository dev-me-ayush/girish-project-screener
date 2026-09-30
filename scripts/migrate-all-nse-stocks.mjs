import { neon } from "@neondatabase/serverless";
import zlib from "node:zlib";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  console.log("=== UPDATING ALL NSE STOCKS WITH CLEAN NAMES & INSTRUMENT KEYS ===");

  // 1. Download official Upstox NSE instrument master file
  console.log("\n1. Downloading Upstox official NSE instrument master...");
  const upstoxRes = await fetch("https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz");
  if (!upstoxRes.ok) {
    throw new Error(`Failed to download Upstox instruments: ${upstoxRes.status}`);
  }
  const upstoxBuffer = await upstoxRes.arrayBuffer();
  const upstoxJson = zlib.gunzipSync(Buffer.from(upstoxBuffer)).toString("utf-8");
  const upstoxInstruments = JSON.parse(upstoxJson);
  console.log(`   ✓ Loaded ${upstoxInstruments.length} total Upstox instruments.`);

  // 2. Filter for all active NSE Equities (segment = NSE_EQ and instrument_type = EQ)
  const equityMap = new Map();

  for (const inst of upstoxInstruments) {
    if (inst.segment === "NSE_EQ" && inst.instrument_type === "EQ" && inst.trading_symbol && inst.isin) {
      const sym = inst.trading_symbol.trim().toUpperCase();
      const isin = inst.isin.trim().toUpperCase();
      const instrumentKey = inst.instrument_key || `NSE_EQ|${isin}`;
      const name = (inst.name || inst.short_name || sym).trim();

      if (!equityMap.has(sym)) {
        equityMap.set(sym, {
          symbol: sym,
          name: name.slice(0, 255),
          instrumentKey,
          isin,
          sector: "Equity",
        });
      }
    }
  }

  const allStocks = Array.from(equityMap.values());
  console.log(`\n2. Filtered total distinct NSE Equities: ${allStocks.length}`);
  console.log("   Sample record:", allStocks[0]);

  // 3. Bulk Upsert in chunks of 500 using PostgreSQL UNNEST
  console.log("\n3. Executing high-speed bulk upsert into Neon PostgreSQL...");
  const chunkSize = 500;
  let totalCommitted = 0;

  for (let i = 0; i < allStocks.length; i += chunkSize) {
    const chunk = allStocks.slice(i, i + chunkSize);
    const symbols = chunk.map((s) => s.symbol);
    const names = chunk.map((s) => s.name);
    const keys = chunk.map((s) => s.instrumentKey);
    const isins = chunk.map((s) => s.isin);
    const sectors = chunk.map((s) => s.sector);

    await sql`
      INSERT INTO stocks (symbol, name, instrument_key, isin, sector, updated_at)
      SELECT 
        u.sym, 
        u.nm, 
        u.ikey, 
        u.isn, 
        u.sec, 
        NOW()
      FROM UNNEST(
        ${symbols}::text[],
        ${names}::text[],
        ${keys}::text[],
        ${isins}::text[],
        ${sectors}::text[]
      ) AS u(sym, nm, ikey, isn, sec)
      ON CONFLICT (symbol) DO UPDATE
      SET name = EXCLUDED.name,
          instrument_key = EXCLUDED.instrument_key,
          isin = EXCLUDED.isin,
          sector = EXCLUDED.sector,
          updated_at = NOW();
    `;
    totalCommitted += chunk.length;
    console.log(`   ✓ Committed ${totalCommitted}/${allStocks.length} stocks...`);
  }

  // 4. Verification
  const [countResult] = await sql`SELECT COUNT(*)::int AS count FROM stocks;`;
  console.log(`\n4. VERIFICATION: Total stocks in Neon 'stocks' table: ${countResult.count}`);

  const sampleCheck = await sql`
    SELECT symbol, name, instrument_key, isin 
    FROM stocks 
    WHERE symbol IN ('RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS', 'SUZLON', 'PAYTM', 'ETERNAL', '20MICRONS')
    ORDER BY symbol ASC;
  `;
  console.log("\nSample Verified Records in Database:");
  console.table(sampleCheck);

  console.log("\n=== ALL NSE EQUITIES UPDATED IN NEON DB SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
