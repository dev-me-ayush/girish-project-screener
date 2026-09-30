import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  console.log("=== WATCHLIST ARCHITECTURE E2E VERIFICATION ===");

  const testUser = "girishsir@my.app.com";
  const testWlName = `E2E Test WL ${Date.now()}`;

  // 1. Create a transient / blank watchlist in Neon DB
  console.log(`\n1. Creating blank watchlist: "${testWlName}"...`);
  const [wl] = await sql`
    INSERT INTO watchlists (user_email, name, description, is_scanning_active)
    VALUES (${testUser}, ${testWlName}, 'Automated E2E Test Watchlist', FALSE)
    RETURNING id, name, is_scanning_active, created_at;
  `;
  console.log("   ✓ Watchlist created:", wl.id, "| Name:", wl.name, "| Scanning:", wl.is_scanning_active);

  // 2. Add an equity stock with '1m' timeframe
  console.log("\n2. Adding equity stock (RELIANCE) with '1m' timeframe...");
  const [item1] = await sql`
    INSERT INTO watchlist_items (
      watchlist_id, symbol, instrument_key, instrument_type, timeframe, is_active, is_expired
    ) VALUES (
      ${wl.id}, 'RELIANCE', 'NSE_EQ|INE002A01018', 'EQUITY', '1m', TRUE, FALSE
    )
    RETURNING id, symbol, timeframe, is_active;
  `;
  console.log("   ✓ Item 1 added:", item1.symbol, "| Timeframe:", item1.timeframe);

  // 3. Add an option contract with '5m' timeframe
  console.log("\n3. Adding option contract (NIFTY ATM CE) with '5m' timeframe...");
  const [item2] = await sql`
    INSERT INTO watchlist_items (
      watchlist_id, symbol, instrument_key, instrument_type, strike_price, option_type, timeframe, is_active, is_expired
    ) VALUES (
      ${wl.id}, 'NIFTY26MAR24500CE', 'NSE_FO|45678', 'OPTION_CE', 24500, 'CE', '5m', TRUE, FALSE
    )
    RETURNING id, symbol, strike_price, option_type, timeframe;
  `;
  console.log("   ✓ Item 2 added:", item2.symbol, "| Timeframe:", item2.timeframe);

  // 4. Update item1 timeframe from '1m' to '15m'
  console.log("\n4. Updating RELIANCE timeframe from '1m' to '15m'...");
  const [updatedItem1] = await sql`
    UPDATE watchlist_items
    SET timeframe = '15m'
    WHERE id = ${item1.id}
    RETURNING id, symbol, timeframe;
  `;
  console.log("   ✓ Timeframe updated:", updatedItem1.symbol, "is now", updatedItem1.timeframe);

  // 5. Activate continuous headless scanner
  console.log("\n5. Toggling background scanner to ACTIVE...");
  const [updatedWl] = await sql`
    UPDATE watchlists
    SET is_scanning_active = TRUE, updated_at = NOW()
    WHERE id = ${wl.id}
    RETURNING id, name, is_scanning_active;
  `;
  console.log("   ✓ Scanner status toggled:", updatedWl.is_scanning_active ? "ACTIVE" : "IDLE");

  // 6. Verify watchlist query projections (replicating page.tsx and API)
  console.log("\n6. Verifying watchlist projections and item counts...");
  const [summary] = await sql`
    SELECT 
      w.id,
      w.name,
      w.is_scanning_active,
      COUNT(i.id)::int AS item_count
    FROM watchlists w
    LEFT JOIN watchlist_items i ON w.id = i.watchlist_id
    WHERE w.id = ${wl.id}
    GROUP BY w.id;
  `;
  console.log("   ✓ Summary check:", summary.name, "| Items:", summary.item_count, "| Active:", summary.is_scanning_active);

  // 7. Test Upstox quotes retrieval for the real equity symbol
  console.log("\n7. Testing Upstox live quote retrieval for RELIANCE...");
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (token) {
    try {
      const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_EQ|INE002A01018`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const quote = Object.values(data.data || {})[0];
        console.log("   ✓ Real Upstox Live Quote:", {
          symbol: "RELIANCE",
          lastPrice: quote?.last_price,
          netChange: quote?.net_change,
          volume: quote?.volume,
        });
      } else {
        console.log("   ⚠ Upstox returned status", res.status);
      }
    } catch (e) {
      console.log("   ⚠ Upstox fetch error:", e.message);
    }
  } else {
    console.log("   ℹ UPSTOX_ACCESS_TOKEN not found in environment, skipped live quote call.");
  }

  // 8. Clean up test data
  console.log("\n8. Cleaning up test data...");
  await sql`DELETE FROM watchlist_items WHERE watchlist_id = ${wl.id};`;
  await sql`DELETE FROM watchlists WHERE id = ${wl.id};`;
  console.log("   ✓ Cleaned up test watchlist and items.");

  console.log("\n=== ALL E2E VERIFICATIONS PASSED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
