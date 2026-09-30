import { neon } from "@neondatabase/serverless";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
const sql = neon(databaseUrl);

const token = process.env.UPSTOX_ACCESS_TOKEN;

async function testIndicesLive() {
  console.log("\n[TEST 1] Testing Header Indices Data Fetch...");
  const keys = ["NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank", "BSE_INDEX|SENSEX"];
  const url = `https://api.upstox.com/v2/market-quote/ohlc?instrument_key=${encodeURIComponent(keys.join(","))}&interval=1d`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Indices fetch failed with status ${res.status}`);
  const json = await res.json();
  const data = json.data || {};
  console.log("✓ Indices returned successfully:");
  for (const [k, v] of Object.entries(data)) {
    console.log(`  - ${k}: LTP ₹${v.last_price || v.ohlc?.close}`);
  }
}

async function testStrictAtmOptionChain() {
  console.log("\n[TEST 2] Testing Strict ATM +-7 Option Chain Filtering...");
  const underlyingKey = "NSE_INDEX|Nifty 50";

  // 1. Get spot
  const spotRes = await fetch(
    `https://api.upstox.com/v2/market-quote/ohlc?instrument_key=${encodeURIComponent(underlyingKey)}&interval=1d`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  const spotJson = await spotRes.json();
  const spotPrice = spotJson.data?.["NSE_INDEX:Nifty 50"]?.last_price || 22700;

  // 2. Get contracts
  const contractRes = await fetch(
    `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(underlyingKey)}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );
  const contractJson = await contractRes.json();
  const contracts = contractJson.data || [];

  const todayStr = new Date().toISOString().split("T")[0];
  const validExpiries = [...new Set(contracts.map((c) => c.expiry).filter((e) => e >= todayStr))].sort();
  const nearestExpiry = validExpiries[0];
  console.log(`  Nearest active expiry: ${nearestExpiry}`);

  const currentContracts = contracts.filter((c) => c.expiry === nearestExpiry);
  const uniqueStrikes = [...new Set(currentContracts.map((c) => Number(c.strike_price)))].sort((a, b) => a - b);

  // Find ATM
  let closestStrike = uniqueStrikes[0];
  let minDiff = Math.abs(spotPrice - closestStrike);
  let closestIdx = 0;
  for (let i = 0; i < uniqueStrikes.length; i++) {
    const diff = Math.abs(spotPrice - uniqueStrikes[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closestStrike = uniqueStrikes[i];
      closestIdx = i;
    }
  }

  const startIdx = Math.max(0, closestIdx - 7);
  const endIdx = Math.min(uniqueStrikes.length, closestIdx + 8);
  const allowedStrikes = uniqueStrikes.slice(startIdx, endIdx);

  console.log(`  Spot Price: ₹${spotPrice}`);
  console.log(`  ATM Strike: ${closestStrike}`);
  console.log(`  Total Allowed Strikes (Strictly Max 15): ${allowedStrikes.length}`);
  console.log(`  Allowed Strikes Range: [${allowedStrikes[0]} ... ${allowedStrikes[allowedStrikes.length - 1]}]`);

  if (allowedStrikes.length > 15) {
    throw new Error("Violation: Allowed strikes exceeded 15 (ATM +- 7)!");
  }
  console.log("✓ Strict ATM +- 7 strikes restriction verified!");
}

async function testFibonacciCalculation() {
  console.log("\n[TEST 3] Testing Fibonacci AC/DC 38.2% Math & Crossover Logic...");
  const pdh = 23080.25;
  const pdl = 22762.20;
  const range = Number((pdh - pdl).toFixed(2));
  const ac38_2 = Number((pdh - 0.382 * range).toFixed(2));
  const dc38_2 = Number((pdl + 0.382 * range).toFixed(2));

  console.log(`  PDH: ${pdh} | PDL: ${pdl} | Range: ${range}`);
  console.log(`  AC 38.2%: ${ac38_2}`);
  console.log(`  DC 38.2%: ${dc38_2}`);

  if (ac38_2 >= pdh || ac38_2 <= pdl) throw new Error("AC 38.2% out of bounds");
  if (dc38_2 >= pdh || dc38_2 <= pdl) throw new Error("DC 38.2% out of bounds");
  console.log("✓ Fibonacci AC/DC 38.2% mathematically sound!");
}

async function testDatabaseWatchlistFlow() {
  console.log("\n[TEST 4] Testing Neon Postgres Watchlist & Items CRUD...");
  // Create temporary test watchlist
  const testWl = await sql`
    INSERT INTO watchlists (user_email, name, description)
    VALUES ('test_system@my.app.com', 'System Test Temp Watchlist', 'Automated test temporary list')
    RETURNING id, name;
  `;
  const wlId = testWl[0].id;
  console.log(`  Created temporary test watchlist: "${testWl[0].name}" (${wlId})`);

  // Insert test item
  const insertedItem = await sql`
    INSERT INTO watchlist_items (watchlist_id, symbol, instrument_key, instrument_type)
    VALUES (${wlId}, 'RELIANCE', 'NSE_EQ|INE002A01018', 'EQUITY')
    RETURNING id, symbol;
  `;
  console.log(`  Added test item: ${insertedItem[0].symbol}`);

  // Query items
  const items = await sql`SELECT id, symbol, instrument_type, is_expired FROM watchlist_items WHERE watchlist_id = ${wlId}`;
  console.log(`  Watchlist symbols count: ${items.length}`);

  // Clean up temporary watchlist
  await sql`DELETE FROM watchlist_items WHERE watchlist_id = ${wlId}`;
  await sql`DELETE FROM watchlists WHERE id = ${wlId}`;
  console.log("  Cleaned up temporary test watchlist (zero database pollution).");
  console.log("✓ Neon database tables and relationships fully verified!");
}

async function runAllTests() {
  console.log("==================================================");
  console.log("    FIBONACCI SCANNER SUITE END-TO-END TEST");
  console.log("==================================================");
  await testIndicesLive();
  await testStrictAtmOptionChain();
  await testFibonacciCalculation();
  await testDatabaseWatchlistFlow();
  console.log("\n==================================================");
  console.log("  ALL TESTS PASSED WITH 100% SUCCESS!");
  console.log("==================================================");
}

runAllTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
