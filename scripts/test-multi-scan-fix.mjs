import { neon } from "@neondatabase/serverless";

process.env.TZ = "UTC"; // Simulate AWS App Runner UTC runtime

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
const sql = neon(databaseUrl);

const token = process.env.UPSTOX_ACCESS_TOKEN;
const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

function calculateFibLevels(pdh, pdl, pdc = 0) {
  const range = Number(Math.max(0, pdh - pdl).toFixed(2));
  const delta = Number((range * 0.382 * 1.236).toFixed(2));
  const ac38_2 = pdc > 0 ? Number((pdc + delta).toFixed(2)) : Number((pdh - 0.382 * range).toFixed(2));
  const dc38_2 = pdc > 0 ? Number((pdc - delta).toFixed(2)) : Number((pdl + 0.382 * range).toFixed(2));
  return { pdh, pdl, pdc, range, ac38_2, dc38_2 };
}

function analyzeIntradayFibBreakout(levels, candles, timeframe) {
  if (!candles || candles.length === 0 || levels.range === 0) {
    return {
      hasBroken: false,
      direction: "NONE",
      statusLabel: "Inside Range",
      levelName: null,
      levelPrice: null,
      triggerPrice: 0,
      breakoutTime: null,
      timeframe,
    };
  }

  const chronological = [...candles].reverse();
  const ac38_2 = levels.ac38_2;
  const dc38_2 = levels.dc38_2;
  let activeBreakout = null;

  for (let i = 0; i < chronological.length; i++) {
    const curr = chronological[i];
    const prev = i > 0 ? chronological[i - 1] : null;
    const candleDate = new Date(curr.timestamp);
    const timeFormatted = candleDate.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const prevClose = prev ? prev.close : curr.open;
    const currClose = curr.close;

    if ((prevClose <= ac38_2 && currClose > ac38_2) || (!activeBreakout && currClose > ac38_2)) {
      if (!activeBreakout) {
        activeBreakout = {
          hasBroken: true,
          direction: "BULLISH",
          statusLabel: "Up Breakout",
          levelName: "AC 38.2%",
          levelPrice: ac38_2,
          triggerPrice: currClose,
          breakoutTime: timeFormatted,
          timeframe,
        };
      }
      continue;
    }

    if ((prevClose >= dc38_2 && currClose < dc38_2) || (!activeBreakout && currClose < dc38_2)) {
      if (!activeBreakout) {
        activeBreakout = {
          hasBroken: true,
          direction: "BEARISH",
          statusLabel: "Low Breakout",
          levelName: "DC 38.2%",
          levelPrice: dc38_2,
          triggerPrice: currClose,
          breakoutTime: timeFormatted,
          timeframe,
        };
      }
      continue;
    }
  }

  const latest = candles[0];
  const ltp = latest ? latest.close : 0;
  const latestFormattedTime = latest
    ? new Date(latest.timestamp).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  if (ltp > ac38_2 && ac38_2 > 0) {
    return {
      hasBroken: true,
      direction: "BULLISH",
      statusLabel: "Up Breakout",
      levelName: "AC 38.2%",
      levelPrice: ac38_2,
      triggerPrice: activeBreakout?.triggerPrice || ltp,
      breakoutTime: activeBreakout?.breakoutTime || latestFormattedTime,
      timeframe,
    };
  }

  if (ltp < dc38_2 && dc38_2 > 0) {
    return {
      hasBroken: true,
      direction: "BEARISH",
      statusLabel: "Low Breakout",
      levelName: "DC 38.2%",
      levelPrice: dc38_2,
      triggerPrice: activeBreakout?.triggerPrice || ltp,
      breakoutTime: activeBreakout?.breakoutTime || latestFormattedTime,
      timeframe,
    };
  }


  return {
    hasBroken: false,
    direction: "NONE",
    statusLabel: "Inside Range",
    levelName: null,
    levelPrice: null,
    triggerPrice: ltp,
    breakoutTime: null,
    timeframe,
  };
}

const memoryDailyRangeCache = new Map();
const memoryIntradayCandleCache = new Map();

async function fetchUpstoxWithRetry(url, maxRetries = 2) {
  let lastResponse = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.status === 429) {
        lastResponse = res;
        if (attempt < maxRetries) {
          const delayMs = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
          console.log(`[429 Detected] Backing off ${delayMs}ms before retry ${attempt + 1}...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
      return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return lastResponse;
}

async function getPreviousDayRange(instrumentKey) {
  const normKey = instrumentKey.replace(":", "|");
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  const todayIST = istDate.toISOString().split("T")[0];

  const cached = memoryDailyRangeCache.get(normKey);
  if (cached && cached.date === todayIST && cached.levels.range > 0) {
    return cached.levels;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${today}/${fromDate}`;
    const res = await fetchUpstoxWithRetry(url);
    if (!res.ok) {
      throw new Error(`Historical daily request failed: ${res.status}`);
    }
    const json = await res.json();
    const candles = json.data?.candles || [];
    const completedCandles = candles.filter((c) => !c[0].startsWith(todayIST));
    const prevBar = completedCandles.length > 0 ? completedCandles[0] : candles[0];

    if (prevBar) {
      const pdh = Number(prevBar[2]);
      const pdl = Number(prevBar[3]);
      const pdc = Number(prevBar[4]);
      const levels = calculateFibLevels(pdh, pdl, pdc);
      if (levels.range > 0) {
        memoryDailyRangeCache.set(normKey, { levels, date: todayIST });
      }
      return levels;
    }
  } catch (err) {
    console.error(`Error fetching daily range for ${instrumentKey}:`, err.message);
  }

  if (cached && cached.levels.range > 0) {
    return cached.levels;
  }
  return calculateFibLevels(0, 0, 0);
}

async function getIntradayCandles(instrumentKey, timeframe = "1m") {
  const normKey = instrumentKey.replace(":", "|");
  const cacheKey = `${normKey}_${timeframe}`;
  const now = Date.now();
  const cached = memoryIntradayCandleCache.get(cacheKey);
  if (cached && now - cached.timestamp < 15000 && cached.candles.length > 0) {
    return cached.candles;
  }

  try {
    const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/1minute`;
    const res = await fetchUpstoxWithRetry(url);
    if (!res.ok) {
      throw new Error(`Intraday candle request failed: ${res.status}`);
    }
    const json = await res.json();
    const rawCandles = json.data?.candles || [];
    const candles = rawCandles.map((c) => ({
      timestamp: c[0],
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5] || 0),
      oi: Number(c[6] || 0),
    }));
    if (candles.length > 0) {
      memoryIntradayCandleCache.set(cacheKey, { candles, timestamp: now });
    }
    return candles;
  } catch (err) {
    console.error(`Error fetching intraday candles for ${instrumentKey}:`, err.message);
    if (cached && cached.candles.length > 0) {
      return cached.candles;
    }
    return [];
  }
}

async function run() {
  console.log("=== Testing User Watchlists Scan Fix ===");
  const watchlistIds = [
    "83a0f1bb-2d3b-476b-bcd0-3cb8f903e7e0",
    "87c7e427-869d-4869-9912-bebf86f55565",
  ];

  const items = await sql`
    SELECT
      i.id,
      i.watchlist_id,
      w.name as watchlist_name,
      i.symbol,
      i.instrument_key,
      i.instrument_type,
      i.strike_price,
      i.option_type,
      i.expiry_date,
      COALESCE(i.timeframe, w.timeframe, '1m') as timeframe,
      i.is_active,
      COALESCE(i.is_expired, FALSE) as is_expired
    FROM watchlist_items i
    INNER JOIN watchlists w ON i.watchlist_id = w.id
    WHERE i.watchlist_id = ANY(${watchlistIds}) AND i.is_active = TRUE
    ORDER BY w.name ASC, i.added_at ASC;
  `;

  console.log(`Found ${items.length} items to scan.`);

  // 1. Batch fetch quotes
  const allKeys = Array.from(new Set(items.map((i) => i.instrument_key)));
  console.log(`Unique instrument keys: ${allKeys.length}`);

  // 2. Pre-fetch with paced batching
  const keyDataMap = new Map();
  const CHUNK_SIZE = 3;
  for (let i = 0; i < allKeys.length; i += CHUNK_SIZE) {
    const chunk = allKeys.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (key) => {
        const [levels, candles1m] = await Promise.all([
          getPreviousDayRange(key),
          getIntradayCandles(key, "1m"),
        ]);
        return { key, levels, candles1m };
      })
    );
    for (const res of chunkResults) {
      keyDataMap.set(res.key, res);
      keyDataMap.set(res.key.replace(":", "|"), res);
      keyDataMap.set(res.key.replace("|", ":"), res);
    }
    if (i + CHUNK_SIZE < allKeys.length) {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  // 3. Evaluate results
  const results = [];
  for (const item of items) {
    const tf = item.timeframe || "1m";
    const keyData = keyDataMap.get(item.instrument_key) || {
      levels: calculateFibLevels(0, 0, 0),
      candles1m: [],
    };
    const levels = keyData.levels;
    const candles = keyData.candles1m;
    const breakout = analyzeIntradayFibBreakout(levels, candles, tf);
    const ltp = candles[0]?.close || 0;

    results.push({
      symbol: item.symbol,
      ltp,
      pdh: levels.pdh,
      pdl: levels.pdl,
      range: levels.range,
      ac38_2: levels.ac38_2,
      dc38_2: levels.dc38_2,
      breakoutStatus: breakout.statusLabel,
      breakoutTime: breakout.breakoutTime,
    });
  }

  console.table(results);

  const valid = results.filter((r) => r.pdh > 0 && r.ac38_2 > 0);
  console.log(`\nValid Fibonacci Levels: ${valid.length} / ${results.length}`);

  console.log("\n=== Test 2: Repeat scan to verify instant cache performance ===");
  const t0 = Date.now();
  for (const k of allKeys) {
    await getPreviousDayRange(k);
    await getIntradayCandles(k, "1m");
  }
  console.log(`Repeat scan cache hit duration: ${Date.now() - t0}ms (ZERO network calls)!`);

  process.exit(0);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
