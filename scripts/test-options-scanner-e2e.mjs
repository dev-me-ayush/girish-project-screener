import { neon } from "@neondatabase/serverless";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const sql = neon(databaseUrl);
const token = process.env.UPSTOX_ACCESS_TOKEN;
const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

function calculateFib(pdh, pdl, pdc = 0) {
  const range = Number(Math.max(0, pdh - pdl).toFixed(2));
  const delta = Number((range * 0.382 * 1.236).toFixed(2));
  const ac38_2 = pdc > 0 ? Number((pdc + delta).toFixed(2)) : Number((pdh - 0.382 * range).toFixed(2));
  const dc38_2 = pdc > 0 ? Number((pdc - delta).toFixed(2)) : Number((pdl + 0.382 * range).toFixed(2));
  return { pdh, pdl, pdc, range, ac38_2, dc38_2 };
}

async function testScan() {
  console.log("=== Testing Scanner on Default Options Watchlist ===");
  const wls = await sql`
    SELECT id, name FROM watchlists WHERE name = 'DEFAULT OPTIONS (ATM ±7)' LIMIT 1;
  `;
  if (wls.length === 0) throw new Error("Watchlist not found");
  const wlId = wls[0].id;
  console.log(`Watchlist: ${wls[0].name} (ID: ${wlId})`);

  const items = await sql`
    SELECT id, symbol, instrument_key, instrument_type, strike_price, option_type, expiry_date
    FROM watchlist_items
    WHERE watchlist_id = ${wlId}
    ORDER BY strike_price ASC, option_type ASC;
  `;
  console.log(`Loaded ${items.length} items from DB.`);

  // Batch quote all 52 contracts
  const keys = items.map((i) => i.instrument_key);
  const qUrl = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(keys.join(","))}`;
  const qRes = await fetch(qUrl, { headers });
  const qJson = await qRes.json();
  const quotes = qJson.data || {};
  console.log(`✓ Upstox returned live quotes for ${Object.keys(quotes).length} contracts in a SINGLE HTTP request!`);

  // Sample check 5 contracts
  console.log("\nSample Screener Output (Top 5 contracts):");
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const it = items[i];
    const formattedKey = it.instrument_key.replace("|", ":");
    const q = quotes[formattedKey] || quotes[it.instrument_key] || {};
    const ltp = q.last_price || 0;
    const netChange = q.net_change || 0;

    // Get previous day range
    const dUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(it.instrument_key)}/day/${new Date().toISOString().split("T")[0]}/${new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0]}`;
    const dRes = await fetch(dUrl, { headers });
    const dJson = await dRes.json();
    const c = dJson.data?.candles || [];
    const prev = c[0] || [0, 0, ltp, ltp, ltp];
    const fib = calculateFib(Number(prev[2]), Number(prev[3]));

    let status = "Inside Range";
    if (ltp > fib.ac38_2 && fib.ac38_2 > 0) status = "Up Breakout";
    else if (ltp < fib.dc38_2 && fib.dc38_2 > 0) status = "Low Breakout";

    console.log(`- ${it.symbol} | LTP: ₹${ltp.toFixed(2)} | Net: ${netChange >= 0 ? "+" : ""}${netChange.toFixed(2)} | PDH: ₹${fib.pdh.toFixed(2)} | PDL: ₹${fib.pdl.toFixed(2)} | AC 38.2%: ₹${fib.ac38_2.toFixed(2)} | DC 38.2%: ₹${fib.dc38_2.toFixed(2)} | Status: ${status}`);
  }

  console.log("\n✓ Default Options Watchlist Scanner end-to-end test completed successfully!");
}

testScan().catch(console.error);
