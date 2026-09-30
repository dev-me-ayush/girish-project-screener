import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function inspect() {
  console.log("=== NEON POSTGRESQL DATABASE ANALYSIS ===");

  // 1. Watchlists summary
  const watchlists = await sql`
    SELECT id, name, user_email, is_scanning_active, created_at, updated_at
    FROM watchlists
    ORDER BY created_at ASC;
  `;

  // 2. Count by instrument type across all watchlists
  const typeCounts = await sql`
    SELECT 
      instrument_type,
      COUNT(*)::int AS count
    FROM watchlist_items
    GROUP BY instrument_type
    ORDER BY count DESC;
  `;

  // 3. Detailed items in watchlist_items
  const allItems = await sql`
    SELECT 
      w.name AS watchlist_name,
      i.id,
      i.symbol,
      i.instrument_type,
      i.timeframe,
      i.strike_price,
      i.option_type,
      i.expiry_date,
      i.is_active,
      i.added_at
    FROM watchlist_items i
    JOIN watchlists w ON i.watchlist_id = w.id
    ORDER BY w.name ASC, i.added_at ASC;
  `;

  // 4. screener_stocks catalog count
  const screenerCatalog = await sql`
    SELECT COUNT(*)::int AS count FROM screener_stocks;
  `;

  const screenerStocks = await sql`
    SELECT symbol, name, price, rsi FROM screener_stocks ORDER BY id ASC LIMIT 20;
  `;

  console.log("\n1. WATCHLISTS IN DATABASE:");
  console.log(`Total watchlists: ${watchlists.length}`);
  watchlists.forEach((w) => {
    console.log(`  - [ID: ${w.id}] "${w.name}" (User: ${w.user_email}) | Scanning: ${w.is_scanning_active ? "ACTIVE" : "IDLE"}`);
  });

  console.log("\n2. WATCHLIST ITEMS BREAKDOWN BY TYPE:");
  let totalWatchlistItems = 0;
  typeCounts.forEach((tc) => {
    console.log(`  - ${tc.instrument_type}: ${tc.count}`);
    totalWatchlistItems += tc.count;
  });
  console.log(`  Total Watchlist Items: ${totalWatchlistItems}`);

  console.log("\n3. ALL WATCHLIST ITEMS CURRENTLY SAVED:");
  if (allItems.length === 0) {
    console.log("  (None currently saved in watchlist_items)");
  } else {
    allItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.watchlist_name}] ${item.symbol} | Type: ${item.instrument_type} | TF: ${item.timeframe} | Active: ${item.is_active}`);
    });
  }

  console.log("\n4. SCREENER STOCKS CATALOG (screener_stocks table):");
  console.log(`Total Equities in Catalog: ${screenerCatalog[0]?.count || 0}`);
  screenerStocks.forEach((s) => {
    console.log(`  - ${s.symbol}: ₹${s.price} (RSI: ${s.rsi}) - ${s.name}`);
  });
}

inspect().catch(console.error);
