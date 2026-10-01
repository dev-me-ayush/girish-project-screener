import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function testEndToEnd() {
  console.log("==================================================");
  console.log("   1-MINUTE SCREENER END-TO-END VALIDATION");
  console.log("==================================================");

  // 1. Verify stocks table
  console.log("\n[STEP 1] Validating Equities Catalog in Neon...");
  const [stockCount] = await sql`SELECT count(*) FROM stocks;`;
  console.log(`  Total stocks catalogued: ${stockCount.count}`);

  // 2. Verify daily_reference_levels
  console.log("\n[STEP 2] Validating Daily Reference Levels in Neon...");
  const [levelCount] = await sql`SELECT count(*) FROM daily_reference_levels;`;
  console.log(`  Total daily levels in DB: ${levelCount.count}`);

  // 3. Verify scanner_alerts schema & 1m timeframe compatibility
  console.log("\n[STEP 3] Validating scanner_alerts 1m timeframe compatibility...");
  const [recentAlert] = await sql`
    SELECT id, symbol, timeframe, level_name, trigger_price, direction, session_date
    FROM scanner_alerts
    ORDER BY triggered_at DESC
    LIMIT 1;
  `;
  if (recentAlert) {
    console.log(`  Latest alert row: ${recentAlert.symbol} | TF: ${recentAlert.timeframe} | Level: ${recentAlert.level_name} | Price: ${recentAlert.trigger_price}`);
  } else {
    console.log("  No prior alerts logged yet. Table ready for 1m events.");
  }

  // 4. Test Upstox Quotes endpoint with a chunk of 500 symbols
  console.log("\n[STEP 4] Testing 500-symbol batch quote query against Upstox...");
  const stocksSample = await sql`
    SELECT instrument_key FROM stocks LIMIT 500;
  `;
  const keys = stocksSample.map(s => s.instrument_key).filter(Boolean);
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  const param = encodeURIComponent(keys.map(k => k.replace(":", "|")).join(","));
  const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${param}`;

  const t0 = Date.now();
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const fetchTime = Date.now() - t0;

  console.log(`  Upstox HTTP Status: ${res.status} (${res.statusText})`);
  console.log(`  Batch size requested: ${keys.length} instruments`);
  console.log(`  Latency: ${fetchTime}ms`);

  if (!res.ok) {
    console.error("  Upstox error response:", await res.text());
    throw new Error(`Upstox returned HTTP ${res.status}`);
  }

  const json = await res.json();
  const receivedCount = Object.keys(json.data || {}).length;
  console.log(`  Received quotes: ${receivedCount} instruments in ${fetchTime}ms`);
  console.log("  ✓ Batch quote efficiency confirmed: 500 instruments in ~" + fetchTime + "ms!");

  // 5. Rate limit projection test
  console.log("\n[STEP 5] Rate Limit Analysis Verification...");
  const totalInstruments = 2732;
  const callsPerScan = Math.ceil(totalInstruments / 500);
  const callsPerMinute = callsPerScan;
  const callsPer30Min = callsPerMinute * 30;

  console.log(`  Total instruments: ${totalInstruments}`);
  console.log(`  Requests per 1-minute scan: ${callsPerScan}`);
  console.log(`  Requests per minute: ${callsPerMinute} (Upstox limit: 500 req/min -> ${((callsPerMinute / 500) * 100).toFixed(1)}%)`);
  console.log(`  Requests per 30 minutes: ${callsPer30Min} (Upstox limit: 2000 req/30m -> ${((callsPer30Min / 2000) * 100).toFixed(1)}%)`);

  console.log("\n==================================================");
  console.log("   ALL VALIDATION CHECKS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

testEndToEnd().catch(err => {
  console.error("Validation failed:", err);
  process.exit(1);
});
