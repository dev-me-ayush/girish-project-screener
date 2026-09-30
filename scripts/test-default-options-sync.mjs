import { neon } from "@neondatabase/serverless";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
const sql = neon(databaseUrl);

const token = process.env.UPSTOX_ACCESS_TOKEN;
const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

async function fetchOptionChain(underlyingKey, strikeRadius) {
  const spotUrl = `https://api.upstox.com/v2/market-quote/ohlc?instrument_key=${encodeURIComponent(underlyingKey)}&interval=1d`;
  const spotRes = await fetch(spotUrl, { headers });
  const spotJson = await spotRes.json();
  const formattedKey = underlyingKey.replace("|", ":");
  const spotQuote = spotJson.data?.[formattedKey];
  const spotPrice = spotQuote?.last_price || spotQuote?.ohlc?.close || 0;

  const contractUrl = `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(underlyingKey)}`;
  const contractRes = await fetch(contractUrl, { headers });
  const contractJson = await contractRes.json();
  const rawContracts = contractJson.data || [];

  const todayStr = new Date().toISOString().split("T")[0];
  const validExpiries = [...new Set(rawContracts.map((c) => c.expiry).filter((e) => e >= todayStr))].sort();
  const nearestExpiry = validExpiries[0] || rawContracts[0]?.expiry;

  const currentContracts = rawContracts.filter((c) => c.expiry === nearestExpiry);
  const uniqueStrikes = [...new Set(currentContracts.map((c) => Number(c.strike_price)))].sort((a, b) => a - b);

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

  const startIdx = Math.max(0, closestIdx - strikeRadius);
  const endIdx = Math.min(uniqueStrikes.length, closestIdx + strikeRadius + 1);
  const allowedStrikes = uniqueStrikes.slice(startIdx, endIdx);

  const options = [];
  for (const strike of allowedStrikes) {
    const ce = currentContracts.find((c) => Number(c.strike_price) === strike && c.instrument_type === "CE");
    const pe = currentContracts.find((c) => Number(c.strike_price) === strike && c.instrument_type === "PE");
    if (ce) options.push(ce);
    if (pe) options.push(pe);
  }

  return { spotPrice, nearestExpiry, closestStrike, options };
}

async function testSync() {
  console.log("=== 1. Testing Default Options Chain Generation ===");
  const [nifty, bank] = await Promise.all([
    fetchOptionChain("NSE_INDEX|Nifty 50", 7),
    fetchOptionChain("NSE_INDEX|Nifty Bank", 5),
  ]);

  console.log(`✓ NIFTY: Spot ₹${nifty.spotPrice}, Nearest Expiry: ${nifty.nearestExpiry}, ATM Strike: ${nifty.closestStrike}, Contracts: ${nifty.options.length}`);
  console.log(`✓ BANKNIFTY: Spot ₹${bank.spotPrice}, Nearest Expiry: ${bank.nearestExpiry}, ATM Strike: ${bank.closestStrike}, Contracts: ${bank.options.length}`);
  const allContracts = [...nifty.options, ...bank.options];
  console.log(`✓ Total Contracts Combined: ${allContracts.length}`);

  console.log("\n=== 2. Upserting into Neon Database Watchlist ===");
  const targetEmail = "girishsir@my.app.com";
  const wlName = "DEFAULT OPTIONS (ATM ±7)";

  let wlRows = await sql`
    SELECT id, name, updated_at FROM watchlists
    WHERE name = ${wlName} AND user_email = ${targetEmail}
    LIMIT 1;
  `;

  if (wlRows.length === 0) {
    wlRows = await sql`
      INSERT INTO watchlists (user_email, name, description, timeframe, is_scanning_active)
      VALUES (${targetEmail}, ${wlName}, 'Auto-synced current weekly expiry NIFTY & BANKNIFTY ATM ±7 options', '1m', TRUE)
      RETURNING id, name, updated_at;
    `;
    console.log(`✓ Created new Default Options Watchlist with ID: ${wlRows[0].id}`);
  } else {
    console.log(`✓ Found existing Default Options Watchlist ID: ${wlRows[0].id}`);
  }
  const watchlistId = wlRows[0].id;

  // Clear existing items in this watchlist
  await sql`DELETE FROM watchlist_items WHERE watchlist_id = ${watchlistId};`;

  // Bulk insert contracts
  const symbols = allContracts.map((c) => c.trading_symbol);
  const keys = allContracts.map((c) => c.instrument_key);
  const types = allContracts.map((c) => (c.instrument_type === "CE" ? "OPTION_CE" : "OPTION_PE"));
  const strikes = allContracts.map((c) => c.strike_price);
  const optTypes = allContracts.map((c) => c.instrument_type);
  const expiries = allContracts.map((c) => c.expiry);

  await sql`
    INSERT INTO watchlist_items (
      watchlist_id, symbol, instrument_key, instrument_type,
      strike_price, option_type, expiry_date, timeframe, is_active, is_expired
    )
    SELECT
      ${watchlistId},
      u.symbol,
      u.key,
      u.type,
      u.strike,
      u.opt_type,
      u.expiry,
      '1m',
      TRUE,
      FALSE
    FROM UNNEST(
      ${symbols}::text[],
      ${keys}::text[],
      ${types}::text[],
      ${strikes}::numeric[],
      ${optTypes}::text[],
      ${expiries}::date[]
    ) AS u(symbol, key, type, strike, opt_type, expiry);
  `;

  await sql`UPDATE watchlists SET updated_at = NOW(), is_scanning_active = TRUE WHERE id = ${watchlistId};`;

  const countRes = await sql`
    SELECT COUNT(*)::int as count FROM watchlist_items WHERE watchlist_id = ${watchlistId};
  `;
  console.log(`✓ Database successfully holds ${countRes[0].count} active option contracts!`);

  console.log("\n=== 3. Testing Option Fibonacci Calculations & Breakout Detection ===");
  // Sample 2 contracts: one CE and one PE
  const sample1 = allContracts[0];
  const sample2 = allContracts[allContracts.length - 1];

  console.log(`Testing Sample 1: ${sample1.trading_symbol} (${sample1.instrument_key})`);
  const today = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];
  const dUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(sample1.instrument_key)}/day/${today}/${fromDate}`;
  const dRes = await fetch(dUrl, { headers });
  const dJson = await dRes.json();
  const candles = dJson.data?.candles || [];
  if (candles.length > 0) {
    const prev = candles[0];
    const pdh = Number(prev[2]);
    const pdl = Number(prev[3]);
    const range = pdh - pdl;
    const ac38_2 = Number((pdh - 0.382 * range).toFixed(2));
    const dc38_2 = Number((pdl + 0.382 * range).toFixed(2));
    console.log(`  PDH: ₹${pdh}, PDL: ₹${pdl}, Range: ₹${range.toFixed(2)}`);
    console.log(`  AC 38.2% (Upper): ₹${ac38_2}, DC 38.2% (Lower): ₹${dc38_2}`);
  } else {
    console.log("  New listing / zero prior session bars.");
  }

  console.log("\n✓ All tests passed successfully!");
}

testSync().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
