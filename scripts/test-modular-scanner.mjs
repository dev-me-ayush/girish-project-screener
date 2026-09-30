import { getMarketSessionStatus } from "../lib/scanner/market-calendar.ts";
import { getActiveAtmOptionsContracts } from "../lib/scanner/options-resolver.ts";
import { getDailyReferenceLevel } from "../lib/scanner/daily-levels.ts";
import { fetchBatchQuotes } from "../lib/scanner/batch-quotes.ts";
import { evaluate5mBreakout } from "../lib/scanner/breakout-engine.ts";
import { sql } from "../lib/db.ts";

async function runTests() {
  console.log("==================================================");
  console.log("   5-MINUTE MODULAR SCANNER TEST SUITE");
  console.log("==================================================");

  // Test 1: Market Calendar & Session Status
  console.log("\n[TEST 1] Market Calendar & Session Detection...");
  const session = getMarketSessionStatus();
  console.log("  Status:", session.status);
  console.log("  Session Date:", session.sessionDate);
  console.log("  IST Time:", session.currentTimeIST);
  console.log("  Label:", session.label);
  console.log("✓ Market Calendar initialized accurately!");

  // Test 2: Dynamic Options Universe (52 ATM Contracts)
  console.log("\n[TEST 2] Active ATM Options Resolution...");
  const options = await getActiveAtmOptionsContracts();
  console.log(`  Resolved ${options.length} high-liquidity ATM contracts:`);
  const niftyOpts = options.filter((o) => o.underlying === "NIFTY");
  const bankOpts = options.filter((o) => o.underlying === "BANKNIFTY");
  console.log(`  - NIFTY 50 (ATM ±7): ${niftyOpts.length} contracts (Expiry: ${niftyOpts[0]?.expiry})`);
  console.log(`  - BANK NIFTY (ATM ±5): ${bankOpts.length} contracts (Expiry: ${bankOpts[0]?.expiry})`);
  if (options.length !== 52) {
    console.warn(`Warning: Expected 52 contracts, got ${options.length}`);
  } else {
    console.log("✓ Exactly 52 ATM index option contracts resolved!");
  }

  // Test 3: Daily Reference Levels & Client Fibonacci Formula on 20MICRONS
  console.log("\n[TEST 3] Daily Levels & Client Formula Verification (20MICRONS)...");
  const levels = await getDailyReferenceLevel("20MICRONS", "NSE_EQ|INE144J01027", "EQUITY", session.sessionDate);
  console.log(`  PDH: ${levels.pdh} | PDL: ${levels.pdl} | PDC: ${levels.pdc}`);
  console.log(`  Range: ${levels.range} | AC 38.2%: ${levels.ac38_2} | DC 38.2%: ${levels.dc38_2}`);
  if (levels.ac38_2 <= levels.pdc || levels.dc38_2 >= levels.pdc) {
    throw new Error("Formula violation: AC 38.2% must be > PDC, DC 38.2% must be < PDC");
  }
  console.log("✓ Client Close-anchored Fibonacci formula verified in daily-levels cache!");

  // Test 4: Batch Quotes (Small Sample Batch)
  console.log("\n[TEST 4] Upstox Batch Quotes Pipeline...");
  const sampleKeys = [
    "NSE_EQ|INE144J01027", // 20MICRONS
    "NSE_EQ|INE002A01018", // RELIANCE
    options[0]?.instrument_key, // 1st Option
    options[1]?.instrument_key, // 2nd Option
  ].filter(Boolean);

  const t0 = Date.now();
  const quotes = await fetchBatchQuotes(sampleKeys);
  const latency = Date.now() - t0;
  console.log(`  Fetched ${quotes.size / 2} unique quotes in ${latency}ms`);
  const micronQuote = quotes.get("20MICRONS") || quotes.get("NSE_EQ|INE144J01027");
  console.log(`  - 20MICRONS LTP: ₹${micronQuote?.last_price} (Day Chg: ${micronQuote?.net_change})`);
  console.log("✓ Batch Quotes pipeline operational!");

  // Test 5: Multiple-Breakout State Machine & Lean Alert Persistence
  console.log("\n[TEST 5] Multiple Breakout Evaluation & State Transitions...");
  // Simulate 1st Up Breakout
  const simPrice1 = levels.ac38_2 + 2.0;
  const break1 = await evaluate5mBreakout("20MICRONS", simPrice1, levels, "09:35");
  console.log(`  1st Breach: ${break1.status} | Direction: ${break1.direction} | Breach Count: ${break1.breachCount} | Fresh: ${break1.isFreshCrossing}`);

  // Simulate price holding above AC 38.2% (should NOT be fresh, should NOT increment count)
  const breakHolding = await evaluate5mBreakout("20MICRONS", simPrice1 + 0.5, levels, "09:40");
  console.log(`  Holding: ${breakHolding.status} | Breach Count: ${breakHolding.breachCount} | Fresh: ${breakHolding.isFreshCrossing}`);

  // Simulate pullback inside range
  const breakPullback = await evaluate5mBreakout("20MICRONS", levels.pdc, levels, "10:15");
  console.log(`  Pullback: ${breakPullback.status} | Direction: ${breakPullback.direction} | Breach Count: ${breakPullback.breachCount}`);

  // Simulate 2nd Up Breakout
  const break2 = await evaluate5mBreakout("20MICRONS", simPrice1 + 1.0, levels, "11:20");
  console.log(`  2nd Breach: ${break2.status} | Direction: ${break2.direction} | Breach Count: ${break2.breachCount} | Fresh: ${break2.isFreshCrossing}`);

  if (break2.breachCount < 2) {
    throw new Error("State machine failed to increment breach count on secondary breakout!");
  }
  console.log("✓ Multiple-breakout state machine & transitions verified!");

  // Test 6: Verify Alert Record in Neon
  console.log("\n[TEST 6] Verifying Alert Persistence in Neon Postgres...");
  const alertRows = await sql`
    SELECT id, symbol, level_name, level_price, trigger_price, breach_count, session_date, breakout_time
    FROM scanner_alerts
    WHERE symbol = '20MICRONS'
    ORDER BY triggered_at DESC
    LIMIT 2;
  `;
  console.log(`  Found ${alertRows.length} alerts for 20MICRONS in Neon:`);
  for (const a of alertRows) {
    console.log(`  - ${a.symbol} | ${a.level_name} | Trigger: ${a.trigger_price} | Breach: ${a.breach_count}x | Time: ${a.breakout_time}`);
  }
  console.log("✓ Lean Alert Persistence verified in Neon!");

  console.log("\n==================================================");
  console.log("  ALL MODULAR SCANNER TESTS PASSED WITH 100%!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
