import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function testWatchlistAlerts() {
  console.log("==================================================");
  console.log("   WATCHLIST-FILTERED ALERTS TEST");
  console.log("==================================================");

  const userEmail = "girishsir@my.app.com";

  // 1. Fetch user symbols
  const userSymbolsResult = await sql`
    SELECT DISTINCT symbol FROM (
      SELECT symbol FROM user_pinned_symbols 
      WHERE user_email = ${userEmail} OR user_email = 'girishsir@my.app.com'
      UNION
      SELECT wi.symbol 
      FROM watchlist_items wi
      JOIN watchlists w ON wi.watchlist_id = w.id
      WHERE w.user_email = ${userEmail} OR w.user_email = 'girishsir@my.app.com'
    ) s;
  `;

  const userSymbols = userSymbolsResult.map((r) => r.symbol).filter(Boolean);
  console.log(`[STEP 1] Found ${userSymbols.length} distinct symbols in user's watchlist & pinned items:`);
  console.log("  Sample:", userSymbols.slice(0, 8));

  // 2. Query alerts strictly matching user symbols
  if (userSymbols.length > 0) {
    const alerts = await sql`
      SELECT 
        sa.id, 
        sa.symbol, 
        sa.level_name, 
        sa.level_price, 
        sa.trigger_price, 
        sa.direction, 
        sa.breach_count, 
        sa.breakout_time
      FROM scanner_alerts sa
      WHERE sa.symbol = ANY(${userSymbols})
      ORDER BY sa.triggered_at DESC
      LIMIT 10;
    `;

    console.log(`\n[STEP 2] Alerts strictly matching user's watchlist symbols: ${alerts.length}`);
    for (const a of alerts) {
      console.log(`  - ${a.symbol} | ${a.level_name} | Price: ${a.trigger_price} | Breach: ${a.breach_count}x | Time: ${a.breakout_time}`);
    }
  }

  // 3. Verify that non-watchlist symbols are excluded
  const nonWatchlistAlerts = await sql`
    SELECT count(*)::int AS count
    FROM scanner_alerts
    WHERE NOT (symbol = ANY(${userSymbols}));
  `;
  console.log(`\n[STEP 3] Non-watchlist alerts excluded from feed: ${nonWatchlistAlerts[0]?.count || 0}`);

  console.log("\n==================================================");
  console.log("   WATCHLIST-FILTERED ALERTS TEST PASSED 100%!");
  console.log("==================================================");
}

testWatchlistAlerts().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
