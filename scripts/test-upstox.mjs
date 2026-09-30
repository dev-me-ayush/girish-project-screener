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

async function testProfile() {
  console.log("--- 1. Testing Upstox Profile Endpoint ---");
  const res = await fetch("https://api.upstox.com/v2/user/profile", { headers });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Profile Response:", JSON.stringify(data, null, 2));
  return res.ok;
}

async function testIntraday1Min(instrumentKey) {
  console.log(`\n--- 2. Testing Intraday 1-Minute Candles for ${instrumentKey} ---`);
  const encodedKey = encodeURIComponent(instrumentKey);
  const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodedKey}/1minute`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  console.log("Status:", res.status);
  if (json.data && json.data.candles) {
    console.log(`Received ${json.data.candles.length} candles.`);
    console.log("Latest candle [timestamp, O, H, L, C, V, OI]:", json.data.candles[0]);
    console.log("First candle of the day:", json.data.candles[json.data.candles.length - 1]);
  } else {
    console.log("Response:", JSON.stringify(json, null, 2));
  }
}

async function testHistoricalDaily(instrumentKey) {
  console.log(`\n--- 3. Testing Historical Daily Candles for ${instrumentKey} ---`);
  const encodedKey = encodeURIComponent(instrumentKey);
  // Upstox daily format: /historical-candle/{instrument_key}/day/{to_date}/{from_date}
  // Let's get recent days
  const today = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const url = `https://api.upstox.com/v2/historical-candle/${encodedKey}/day/${today}/${fromDate}`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  console.log("Status:", res.status);
  if (json.data && json.data.candles) {
    console.log(`Received ${json.data.candles.length} daily candles.`);
    console.log("Most recent daily candle (Today / Previous Day):", json.data.candles[0]);
    if (json.data.candles.length > 1) {
      console.log("Previous trading day candle:", json.data.candles[1]);
    }
  } else {
    console.log("Response:", JSON.stringify(json, null, 2));
  }
}

async function testMarketQuoteOHLC(instrumentKey) {
  console.log(`\n--- 4. Testing Market Quote OHLC for ${instrumentKey} ---`);
  const encodedKey = encodeURIComponent(instrumentKey);
  const url = `https://api.upstox.com/v2/market-quote/ohlc?instrument_key=${encodedKey}&interval=1d`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  console.log("Status:", res.status);
  console.log("OHLC Quote:", JSON.stringify(json, null, 2));
}

async function run() {
  await testProfile();

  const sampleInstrument = "NSE_INDEX|Nifty 50";
  await testIntraday1Min(sampleInstrument);
  await testHistoricalDaily(sampleInstrument);
  await testMarketQuoteOHLC(sampleInstrument);

  console.log("\n--- 5. Testing Intraday Candle WITHOUT Auth Headers ---");
  const encodedKey = encodeURIComponent(sampleInstrument);
  const unauthRes = await fetch(`https://api.upstox.com/v2/historical-candle/intraday/${encodedKey}/1minute`, {
    headers: { Accept: "application/json" }
  });
  console.log("Unauth Status:", unauthRes.status);
  const unauthJson = await unauthRes.json();
  if (unauthJson.data?.candles) {
    console.log(`Unauth success! Candles count: ${unauthJson.data.candles.length}`);
    console.log("Latest candle:", unauthJson.data.candles[0]);
  } else {
    console.log("Unauth response:", JSON.stringify(unauthJson, null, 2));
  }
}

run().catch((err) => console.error("Error executing test:", err));
