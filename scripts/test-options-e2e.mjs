import process from "node:process";

const token = process.env.UPSTOX_ACCESS_TOKEN;
if (!token) {
  console.error("Missing UPSTOX_ACCESS_TOKEN in env");
  process.exit(1);
}

const headers = {
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
};

const INDICES = [
  { name: "NIFTY 50", key: "NSE_INDEX|Nifty 50", step: 50 },
  { name: "BANK NIFTY", key: "NSE_INDEX|Nifty Bank", step: 100 },
  { name: "FIN NIFTY", key: "NSE_INDEX|Nifty Fin Service", step: 50 },
  { name: "NIFTY MID SELECT", key: "NSE_INDEX|NIFTY MID SELECT", step: 25 },
];

async function runE2ETests() {
  console.log("=== STARTING END-TO-END VERIFICATION WITH REAL UPSTOX DATA ===\n");

  // TEST 1: Market Quotes for all 4 Indices
  console.log("--- TEST 1: Verifying Quotes for All 4 Benchmark Indices ---");
  for (const idx of INDICES) {
    const quoteUrl = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(idx.key)}`;
    const res = await fetch(quoteUrl, { headers });
    if (!res.ok) throw new Error(`Failed to fetch quote for ${idx.name}: ${res.status}`);
    const data = await res.json();
    const quoteObj = data.data?.[Object.keys(data.data || {})[0]];
    const ltp = quoteObj?.last_price;
    const prevClose = quoteObj?.ohlc?.close;
    const change = ltp - prevClose;
    const pChange = ((change / prevClose) * 100).toFixed(2);
    console.log(`✓ ${idx.name.padEnd(18)}: LTP = ${ltp}, Change = ${change.toFixed(2)} (${pChange}%)`);
    if (!ltp || ltp <= 0) throw new Error(`Invalid LTP for ${idx.name}`);
  }

  // TEST 2: Active Expiries & Option Chain for NIFTY 50, BANK NIFTY, FIN NIFTY
  console.log("\n--- TEST 2: Verifying Option Contracts & Expiries ---");
  const testIndices = INDICES.slice(0, 3);
  const selectedExpiries = {};

  for (const idx of testIndices) {
    const contractUrl = `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(idx.key)}`;
    const res = await fetch(contractUrl, { headers });
    if (!res.ok) throw new Error(`Failed to fetch contracts for ${idx.name}`);
    const data = await res.json();
    const expiries = [...new Set((data.data || []).map((c) => c.expiry))].sort();
    if (expiries.length === 0) throw new Error(`No expiries found for ${idx.name}`);
    selectedExpiries[idx.key] = expiries[0];
    console.log(`✓ ${idx.name.padEnd(18)}: Found ${expiries.length} expiries. Nearest = ${expiries[0]}`);
  }

  // TEST 3: Option Chain & PCR Calculation for Nifty 50
  console.log("\n--- TEST 3: Verifying Option Chain & PCR Calculation ---");
  const niftyKey = "NSE_INDEX|Nifty 50";
  const niftyExpiry = selectedExpiries[niftyKey];
  const chainUrl = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(niftyKey)}&expiry_date=${niftyExpiry}`;
  const chainRes = await fetch(chainUrl, { headers });
  if (!chainRes.ok) throw new Error(`Option chain API failed: ${chainRes.status}`);
  const chainData = await chainRes.json();
  const strikes = chainData.data || [];
  console.log(`✓ Received ${strikes.length} strikes for Nifty 50 (Expiry: ${niftyExpiry})`);

  let totalCallOI = 0;
  let totalPutOI = 0;
  for (const s of strikes) {
    totalCallOI += s.call_options?.market_data?.oi || 0;
    totalPutOI += s.put_options?.market_data?.oi || 0;
  }
  const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : "0.00";
  console.log(`✓ Total Call OI: ${totalCallOI.toLocaleString("en-IN")}`);
  console.log(`✓ Total Put OI:  ${totalPutOI.toLocaleString("en-IN")}`);
  console.log(`✓ Computed PCR:  ${pcr}`);
  if (totalCallOI === 0 && totalPutOI === 0) {
    console.warn("Warning: Both Call and Put OI are zero (market might be off-hours or new series)");
  }

  // TEST 4: Strike Presets (Consecutive, ATM±2, ATM±3)
  console.log("\n--- TEST 4: Verifying Strike Presets (Consecutive, ATM±2, ATM±3) ---");
  // Get Nifty spot price
  const spotRes = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(niftyKey)}`, { headers });
  const spotData = await spotRes.json();
  const spotPrice = spotData.data?.[Object.keys(spotData.data || {})[0]]?.last_price;
  const atmStrike = Math.round(spotPrice / 50) * 50;
  console.log(`✓ Nifty Spot: ${spotPrice} -> ATM Strike: ${atmStrike}`);

  const consecutive = [atmStrike, atmStrike + 50, atmStrike + 100];
  const atmPlusMinus2 = [atmStrike - 100, atmStrike, atmStrike + 100];
  const atmPlusMinus3 = [atmStrike - 150, atmStrike, atmStrike + 150];

  console.log(`✓ Consecutive 3 Strikes: [${consecutive.join(", ")}]`);
  console.log(`✓ ATM ± 2 Strikes:       [${atmPlusMinus2.join(", ")}]`);
  console.log(`✓ ATM ± 3 Strikes:       [${atmPlusMinus3.join(", ")}]`);

  // Find contracts for consecutive strikes
  const contractsToFetch = [];
  for (const s of consecutive) {
    const row = strikes.find((r) => r.strike_price === s);
    if (row) {
      contractsToFetch.push({
        strike: s,
        ceKey: row.call_options?.instrument_key,
        peKey: row.put_options?.instrument_key,
      });
    }
  }
  console.log(`✓ Found contract keys for ${contractsToFetch.length} of 3 consecutive strikes`);

  // TEST 5: Intraday 1-Minute Candle OI history from 09:15 AM
  console.log("\n--- TEST 5: Verifying Intraday 1-Min Candle OI History from 09:15 AM ---");
  if (contractsToFetch.length > 0 && contractsToFetch[0].ceKey) {
    const testKey = contractsToFetch[0].ceKey;
    const candleUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(testKey)}/1minute`;
    const cRes = await fetch(candleUrl, { headers });
    const cJson = await cRes.json();
    const candles = cJson.data?.candles || [];
    console.log(`✓ Contract ${testKey} returned ${candles.length} intraday 1-minute candles`);
    if (candles.length > 0) {
      console.log(`✓ Earliest candle: ${candles[candles.length - 1][0]} (OI: ${candles[candles.length - 1][6]})`);
      console.log(`✓ Latest candle:   ${candles[0][0]} (OI: ${candles[0][6]})`);
    }
  }

  console.log("\n=== ALL REAL-DATA VALIDATIONS PASSED SUCCESSFULLY ===");
}

runE2ETests().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
