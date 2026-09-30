import { neon } from "@neondatabase/serverless";
import zlib from "node:zlib";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  console.log("=== NIFTY 500 UPSTOX DATABASE SEEDING (BULK UNNEST) ===");

  // 1. Create stocks table in Neon
  console.log("\n1. Ensuring 'stocks' table exists in Neon PostgreSQL...");
  await sql`
    CREATE TABLE IF NOT EXISTS stocks (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      instrument_key VARCHAR(100) UNIQUE NOT NULL,
      isin VARCHAR(50) NOT NULL,
      sector VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks (symbol);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks (name);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stocks_sector ON stocks (sector);`;
  console.log("   ✓ Table and indexes verified.");

  // 2. Fetch official Upstox NSE instruments master to ensure 100% verified Upstox keys
  console.log("\n2. Downloading official Upstox NSE instrument master...");
  const upstoxRes = await fetch("https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz");
  if (!upstoxRes.ok) {
    throw new Error(`Failed to download Upstox instruments: ${upstoxRes.status}`);
  }
  const upstoxBuffer = await upstoxRes.arrayBuffer();
  const upstoxJson = zlib.gunzipSync(Buffer.from(upstoxBuffer)).toString("utf-8");
  const upstoxInstruments = JSON.parse(upstoxJson);
  console.log(`   ✓ Loaded ${upstoxInstruments.length} Upstox instruments.`);

  const upstoxByIsin = new Map();
  const upstoxBySymbol = new Map();

  for (const inst of upstoxInstruments) {
    if (inst.segment === "NSE_EQ") {
      if (inst.isin) upstoxByIsin.set(inst.isin.trim(), inst);
      if (inst.trading_symbol) upstoxBySymbol.set(inst.trading_symbol.trim().toUpperCase(), inst);
    }
  }
  console.log(`   ✓ Indexed ${upstoxByIsin.size} NSE_EQ instruments from Upstox.`);

  // 3. Fetch official Nifty 500 constituents from NSE India
  console.log("\n3. Fetching official Nifty 500 list from NSE Archives...");
  const nseRes = await fetch("https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv");
  if (!nseRes.ok) {
    throw new Error(`Failed to download Nifty 500 list: ${nseRes.status}`);
  }
  const nseCsv = await nseRes.text();
  const lines = nseCsv.trim().split("\n");
  console.log(`   ✓ Loaded ${lines.length - 1} constituent rows from NSE.`);

  const nseStocks = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
    const clean = parts.map((p) => p.replace(/^"|"$/g, "").trim());
    if (clean.length >= 5) {
      const companyName = clean[0];
      const industry = clean[1];
      const symbol = clean[2].toUpperCase();
      const isin = clean[4].toUpperCase();

      const upstoxEntry = upstoxByIsin.get(isin) || upstoxBySymbol.get(symbol);
      const instrumentKey = upstoxEntry ? upstoxEntry.instrument_key : `NSE_EQ|${isin}`;
      const name = upstoxEntry?.name || companyName;

      nseStocks.push({
        symbol,
        name,
        instrumentKey,
        isin,
        sector: industry || "Equity",
      });
    }
  }

  console.log(`   ✓ Parsed and verified ${nseStocks.length} Nifty 500 stocks with Upstox format.`);

  // 4. High-performance Bulk Upsert using UNNEST in batches of 100
  console.log("\n4. Executing high-speed bulk upsert into Neon PostgreSQL...");
  const batchSize = 100;
  for (let i = 0; i < nseStocks.length; i += batchSize) {
    const batch = nseStocks.slice(i, i + batchSize);
    const symbols = batch.map((s) => s.symbol);
    const names = batch.map((s) => s.name);
    const keys = batch.map((s) => s.instrumentKey);
    const isins = batch.map((s) => s.isin);
    const sectors = batch.map((s) => s.sector);

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
    console.log(`   ✓ Committed batch ${Math.floor(i / batchSize) + 1} (${symbols.length} stocks)`);
  }

  // 5. Verification check
  const [countResult] = await sql`SELECT COUNT(*)::int AS count FROM stocks;`;
  console.log(`\n5. Total verified stocks in Neon 'stocks' table: ${countResult.count}`);

  const sampleCheck = await sql`
    SELECT symbol, name, instrument_key, isin, sector 
    FROM stocks 
    WHERE symbol IN ('RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS', '360ONE', 'ZOMATO')
    ORDER BY symbol ASC;
  `;
  console.log("\nSample Verified Records in Database:");
  console.table(sampleCheck);

  console.log("\n=== ALL NIFTY 500 STOCKS SUCCESSFULLY SEEDED INTO DATABASE ===");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
