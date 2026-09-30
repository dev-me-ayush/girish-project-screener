import { sql } from "./db";
import {
  getIntradayCandles,
  getPreviousDayRange,
  getQuotesAndOI,
} from "./upstox";
import {
  evaluateCrossover,
  analyzeIntradayFibBreakout,
  aggregateCandles,
  calculateFibLevels,
  Candle,
  FibLevels,
  CrossoverEvaluation,
  FibBreakoutEvaluation,
} from "./fibonacci";

export interface MarketStatus {
  isOpen: boolean;
  status: "OPEN" | "CLOSED" | "PRE_OPEN" | "WEEKEND";
  message: string;
  currentTimeIST: string;
  nextSession: string;
}

/**
 * Computes live status of the National Stock Exchange (NSE)
 * Monday - Friday: 09:15 - 15:30 IST (Regular Trading)
 * Saturday - Sunday: Weekend Closed
 */
export function getIndianMarketStatus(): MarketStatus {
  const now = new Date();
  // IST is UTC+5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);

  const dayOfWeek = istDate.getUTCDay(); // 0 = Sun, 6 = Sat
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const timeMinutes = hours * 60 + minutes;

  const istFormatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} IST`;

  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isOpen: false,
      status: "WEEKEND",
      message: "NSE is closed for the weekend. Scanner maintains active state in Neon DB.",
      currentTimeIST: istFormatted,
      nextSession: "Monday 09:15 AM IST",
    };
  }

  // Pre-Open session: 09:00 - 09:15 AM
  if (timeMinutes >= 540 && timeMinutes < 555) {
    return {
      isOpen: false,
      status: "PRE_OPEN",
      message: "NSE Pre-Open Session (09:00 - 09:15 AM). Regular market opens shortly.",
      currentTimeIST: istFormatted,
      nextSession: "09:15 AM IST",
    };
  }

  // Regular Trading Session: 09:15 - 15:30 (555 to 930 mins)
  if (timeMinutes >= 555 && timeMinutes <= 930) {
    return {
      isOpen: true,
      status: "OPEN",
      message: "NSE Live Market Session is active.",
      currentTimeIST: istFormatted,
      nextSession: "Closes at 03:30 PM IST",
    };
  }

  // After-hours
  return {
    isOpen: false,
    status: "CLOSED",
    message: "NSE Market is closed. Scanner in standby mode. Active state preserved in Neon DB.",
    currentTimeIST: istFormatted,
    nextSession: timeMinutes < 540 ? "Today 09:15 AM IST" : "Next Trading Day 09:15 AM IST",
  };
}

export interface ScannedSymbolResult {
  id: string;
  symbol: string;
  instrumentKey: string;
  instrumentType: string;
  isExpired: boolean;
  timeframe: string;
  strikePrice: number | null;
  optionType: string | null;
  expiryDate: string | null;
  ltp: number;
  openInterest: number;
  volume: number;
  netChange: number;
  levels: FibLevels;
  crossover: CrossoverEvaluation;
}

export interface ScannerRunResponse {
  watchlistId: string;
  timeframe: string;
  scannedAt: string;
  marketStatus: MarketStatus;
  totalSymbols: number;
  activeSymbols: number;
  expiredSymbols: number;
  crossoversDetected: number;
  results: ScannedSymbolResult[];
}

/**
 * Executes a full scan on the given watchlist.
 * 1. Checks and flags expired option contracts
 * 2. Fetches Previous Day Range (PDH / PDL) & computes Fib AC/DC 38.2%
 * 3. Fetches latest candles for each symbol's configured timeframe & detects crossovers
 * 4. Pulls live Open Interest (OI) and quotes
 * 5. Saves triggered crossover alerts into Neon database
 */
export async function runWatchlistScan(
  watchlistId: string,
  overrideTimeframe?: "1m" | "2m" | "3m" | "5m" | "15m"
): Promise<ScannerRunResponse> {
  const marketStatus = getIndianMarketStatus();

  // 1. Fetch watchlist items with their individual configured timeframe
  const items = (await sql`
    SELECT id, watchlist_id, symbol, instrument_key, instrument_type, strike_price, option_type, expiry_date, timeframe, is_active, is_expired
    FROM watchlist_items
    WHERE watchlist_id = ${watchlistId} AND is_active = TRUE
    ORDER BY added_at ASC
  `) as Array<{
    id: string;
    watchlist_id: string;
    symbol: string;
    instrument_key: string;
    instrument_type: string;
    strike_price: string | number | null;
    option_type: string | null;
    expiry_date: string | null;
    timeframe?: string;
    is_active?: boolean;
    is_expired: boolean;
  }>;

  const todayStr = new Date().toISOString().split("T")[0];
  const nowIso = new Date().toISOString();

  // 2. Identify and flag expired items
  const expiredIds: string[] = [];
  const activeItems: typeof items = [];

  for (const item of items) {
    let isExpired = Boolean(item.is_expired);
    if (item.expiry_date && !isExpired) {
      const expDate = new Date(item.expiry_date).toISOString().split("T")[0];
      if (expDate < todayStr) {
        isExpired = true;
        expiredIds.push(item.id);
      }
    }

    if (isExpired) {
      item.is_expired = true;
    } else {
      activeItems.push(item);
    }
  }

  // Update expired flags in database
  if (expiredIds.length > 0) {
    for (const expId of expiredIds) {
      await sql`
        UPDATE watchlist_items
        SET is_expired = TRUE
        WHERE id = ${expId}
      `;
    }
  }

  // 3. Batch fetch live quotes and OI for all items
  const allKeys = items.map((i) => i.instrument_key);
  const liveQuotes = await getQuotesAndOI(allKeys);

  // Pre-fetch levels and intraday candles for unique active keys in paced batches
  const activeKeys = Array.from(new Set(activeItems.map((i) => i.instrument_key)));
  const keyDataMap = new Map<string, { levels: FibLevels; candles1m: Candle[] }>();
  const CHUNK_SIZE = 3;
  for (let i = 0; i < activeKeys.length; i += CHUNK_SIZE) {
    const chunk = activeKeys.slice(i, i + CHUNK_SIZE);
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
    if (i + CHUNK_SIZE < activeKeys.length) {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  const scannedResults: ScannedSymbolResult[] = [];
  let crossoversDetectedCount = 0;

  // 4. Process each active symbol with its respective timeframe
  for (const item of items) {
    const quote = liveQuotes[item.instrument_key] || {
      lastPrice: 0,
      oi: 0,
      volume: 0,
      netChange: 0,
    };

    const targetTimeframe = (overrideTimeframe || item.timeframe || "1m") as "1m" | "2m" | "3m" | "5m" | "15m";
    const mappedTf: "1m" | "2m" | "3m" | "5m" | "15m" =
      targetTimeframe === "15m"
        ? "15m"
        : targetTimeframe === "5m"
        ? "5m"
        : targetTimeframe === "3m"
        ? "3m"
        : targetTimeframe === "2m"
        ? "2m"
        : "1m";

    if (item.is_expired) {
      scannedResults.push({
        id: item.id,
        symbol: item.symbol,
        instrumentKey: item.instrument_key,
        instrumentType: item.instrument_type,
        isExpired: true,
        timeframe: item.timeframe || "1m",
        strikePrice: item.strike_price ? Number(item.strike_price) : null,
        optionType: item.option_type,
        expiryDate: item.expiry_date,
        ltp: quote.lastPrice,
        openInterest: quote.oi,
        volume: quote.volume,
        netChange: quote.netChange,
        levels: { pdh: 0, pdl: 0, pdc: 0, range: 0, ac38_2: 0, dc38_2: 0 },
        crossover: {
          hasCrossed: false,
          crossoverType: "NONE",
          label: "EXPIRED CONTRACT",
          levelPrice: null,
          triggerPrice: 0,
          timestamp: nowIso,
        },
      });
      continue;
    }

    // For active symbols: retrieve pre-fetched daily range & 1m intraday candles, then resample if needed
    const targetMinutes = mappedTf === "15m" ? 15 : mappedTf === "5m" ? 5 : mappedTf === "3m" ? 3 : mappedTf === "2m" ? 2 : 1;
    const keyData = keyDataMap.get(item.instrument_key) ||
      keyDataMap.get(item.instrument_key.replace(":", "|")) ||
      keyDataMap.get(item.instrument_key.replace("|", ":")) || {
        levels: calculateFibLevels(0, 0, 0),
        candles1m: [],
      };
    const fibLevels = keyData.levels;
    const intradayCandles = aggregateCandles(keyData.candles1m, targetMinutes);

    const crossover = evaluateCrossover(fibLevels, intradayCandles);

    // If crossover happened, log into database
    if (crossover.hasCrossed && crossover.levelPrice !== null) {
      crossoversDetectedCount++;
      const direction = crossover.crossoverType.includes("BULLISH") ? "BULLISH" : "BEARISH";

      try {
        await sql`
          INSERT INTO scanner_alerts (
            watchlist_id, symbol, instrument_key, timeframe, level_type,
            level_price, trigger_price, direction, open_interest, triggered_at
          ) VALUES (
            ${watchlistId}, ${item.symbol}, ${item.instrument_key}, ${mappedTf},
            ${crossover.crossoverType}, ${crossover.levelPrice}, ${crossover.triggerPrice},
            ${direction}, ${quote.oi}, ${crossover.timestamp}
          );
        `;
      } catch (dbErr) {
        console.error("Failed to insert alert:", dbErr);
      }
    }

    scannedResults.push({
      id: item.id,
      symbol: item.symbol,
      instrumentKey: item.instrument_key,
      instrumentType: item.instrument_type,
      isExpired: false,
      timeframe: item.timeframe || "1m",
      strikePrice: item.strike_price ? Number(item.strike_price) : null,
      optionType: item.option_type,
      expiryDate: item.expiry_date,
      ltp: quote.lastPrice || intradayCandles[0]?.close || 0,
      openInterest: quote.oi,
      volume: quote.volume,
      netChange: quote.netChange,
      levels: fibLevels,
      crossover,
    });
  }

  return {
    watchlistId,
    timeframe: overrideTimeframe || "PER_SYMBOL",
    scannedAt: nowIso,
    marketStatus,
    totalSymbols: items.length,
    activeSymbols: activeItems.length,
    expiredSymbols: expiredIds.length,
    crossoversDetected: crossoversDetectedCount,
    results: scannedResults,
  };
}

/**
 * Headless Background Scanner Daemon:
 * Scans all watchlists that have `is_scanning_active = TRUE`.
 * Survives market close without failing, stays in standby when market is closed,
 * and automatically resumes active polling at 09:15 AM IST next day.
 */
export async function runHeadlessBackgroundScan() {
  const marketStatus = getIndianMarketStatus();

  const activeWatchlists = await sql`
    SELECT id, name
    FROM watchlists
    WHERE is_scanning_active = TRUE;
  `;

  const runSummary = [];

  for (const wl of activeWatchlists) {
    try {
      const scanResult = await runWatchlistScan(wl.id as string);
      await sql`
        UPDATE watchlists
        SET last_scanned_at = NOW()
        WHERE id = ${wl.id as string};
      `;
      runSummary.push({
        watchlistId: wl.id,
        name: wl.name,
        success: true,
        symbolsScanned: scanResult.activeSymbols,
        crossoversDetected: scanResult.crossoversDetected,
      });
    } catch (err) {
      console.error(`Error scanning watchlist ${wl.id}:`, err);
      runSummary.push({
        watchlistId: wl.id,
        name: wl.name,
        success: false,
        error: err instanceof Error ? err.message : "Scan failed",
      });
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    marketStatus,
    totalActiveWatchlists: activeWatchlists.length,
    summary: runSummary,
  };
}

/**
 * Multi-Watchlist Screener Result
 */
export interface MultiWatchlistSymbolResult {
  itemId: string;
  watchlistId: string;
  watchlistName: string;
  symbol: string;
  instrumentKey: string;
  instrumentType: string;
  timeframe: string;
  isExpired: boolean;
  ltp: number;
  netChange: number;
  openInterest: number;
  volume: number;
  pdh: number;
  pdl: number;
  pdc: number;
  range: number;
  ac38_2: number;
  dc38_2: number;
  level50: number;
  level61_8: number;
  breakout: FibBreakoutEvaluation;
}

export interface MultiWatchlistScanResponse {
  scannedAt: string;
  marketStatus: MarketStatus;
  totalWatchlists: number;
  totalStocks: number;
  results: MultiWatchlistSymbolResult[];
}

/**
 * Runs aggregated scan across multiple selected watchlists
 */
export async function runMultiWatchlistScan(
  watchlistIds?: string[]
): Promise<MultiWatchlistScanResponse> {
  const marketStatus = getIndianMarketStatus();

  // If watchlistIds provided and non-empty, use them; otherwise fetch all watchlists
  let targetWlIds = (watchlistIds || []).filter(Boolean);
  if (targetWlIds.length === 0) {
    const allWls = await sql`SELECT id FROM watchlists;`;
    targetWlIds = (allWls as Array<{ id: string }>).map((w) => w.id);
  }

  if (targetWlIds.length === 0) {
    return {
      scannedAt: new Date().toISOString(),
      marketStatus,
      totalWatchlists: 0,
      totalStocks: 0,
      results: [],
    };
  }

  // Fetch all items belonging to selected watchlists
  const items = (await sql`
    SELECT wi.id, wi.watchlist_id, w.name as watchlist_name, wi.symbol, wi.instrument_key,
           wi.instrument_type, wi.strike_price, wi.option_type, wi.expiry_date, wi.timeframe,
           wi.is_active, wi.is_expired
    FROM watchlist_items wi
    JOIN watchlists w ON wi.watchlist_id = w.id
    WHERE wi.watchlist_id = ANY(${targetWlIds}) AND wi.is_active = TRUE
    ORDER BY w.name ASC, wi.added_at ASC
  `) as Array<{
    id: string;
    watchlist_id: string;
    watchlist_name: string;
    symbol: string;
    instrument_key: string;
    instrument_type: string;
    strike_price: string | number | null;
    option_type: string | null;
    expiry_date: string | null;
    timeframe?: string;
    is_active?: boolean;
    is_expired: boolean;
  }>;

  // Batch fetch quotes & OI
  const allKeys = Array.from(new Set(items.map((i) => i.instrument_key)));
  const liveQuotes = await getQuotesAndOI(allKeys);

  // Pre-fetch levels and intraday candles for unique keys in paced batches to respect Upstox rate limits
  const keyDataMap = new Map<string, { levels: FibLevels; candles1m: Candle[] }>();
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

  const results: MultiWatchlistSymbolResult[] = [];

  for (const item of items) {
    const quote =
      liveQuotes[item.instrument_key] ||
      liveQuotes[item.instrument_key.replace(":", "|")] ||
      liveQuotes[item.instrument_key.replace("|", ":")] ||
      liveQuotes[item.symbol] ||
      liveQuotes[`NSE_EQ:${item.symbol}`] ||
      liveQuotes[`NSE_EQ|${item.symbol}`] ||
      liveQuotes[`NSE_FO:${item.symbol}`] ||
      liveQuotes[`NSE_FO|${item.symbol}`] || {
        lastPrice: 0,
        oi: 0,
        volume: 0,
        netChange: 0,
      };

    const tf = (item.timeframe || "1m") as "1m" | "2m" | "3m" | "5m" | "15m";
    const minutes = tf === "15m" ? 15 : tf === "5m" ? 5 : tf === "3m" ? 3 : tf === "2m" ? 2 : 1;
    const keyData = keyDataMap.get(item.instrument_key) ||
      keyDataMap.get(item.instrument_key.replace(":", "|")) ||
      keyDataMap.get(item.instrument_key.replace("|", ":")) || {
        levels: calculateFibLevels(0, 0, 0),
        candles1m: [],
      };
    const levels = keyData.levels;
    const candles = aggregateCandles(keyData.candles1m, minutes);

    const breakout = analyzeIntradayFibBreakout(levels, candles, tf);

    results.push({
      itemId: item.id,
      watchlistId: item.watchlist_id,
      watchlistName: item.watchlist_name,
      symbol: item.symbol,
      instrumentKey: item.instrument_key,
      instrumentType: item.instrument_type,
      timeframe: tf,
      isExpired: Boolean(item.is_expired),
      ltp: quote.lastPrice || candles[0]?.close || 0,
      netChange: quote.netChange,
      openInterest: quote.oi || (candles[0] ? candles[0].oi : 0),
      volume: quote.volume || (candles[0] ? candles[0].volume : 0),
      pdh: levels.pdh,
      pdl: levels.pdl,
      pdc: levels.pdc,
      range: levels.range,
      ac38_2: levels.ac38_2,
      dc38_2: levels.dc38_2,
      level50: levels.level50 || Number((levels.pdl + 0.5 * levels.range).toFixed(2)),
      level61_8: levels.level61_8 || Number((levels.pdl + 0.618 * levels.range).toFixed(2)),
      breakout,
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    marketStatus,
    totalWatchlists: targetWlIds.length,
    totalStocks: items.length,
    results,
  };
}

/**
 * Single Symbol Fibonacci Deep-Dive
 * Evaluates Fibonacci levels and all 5 timeframes (1m, 2m, 3m, 5m, 15m)
 * to see whether price broke today, which level broke, on which timeframe, and at what time.
 */
export interface SymbolFibAnalysis {
  symbol: string;
  name: string;
  instrumentKey: string;
  sector?: string;
  quote: {
    lastPrice: number;
    oi: number;
    volume: number;
    netChange: number;
    open: number;
    high: number;
    low: number;
    close: number;
  };
  levels: FibLevels;
  timeframeBreakouts: {
    "1m": FibBreakoutEvaluation;
    "2m": FibBreakoutEvaluation;
    "3m": FibBreakoutEvaluation;
    "5m": FibBreakoutEvaluation;
    "15m": FibBreakoutEvaluation;
  };
  hasAnyBreakoutToday: boolean;
  marketStatus: MarketStatus;
  analyzedAt: string;
}

export async function getSymbolFibonacciAnalysis(
  symbolQuery: string,
  instrumentKey?: string
): Promise<SymbolFibAnalysis | null> {
  const marketStatus = getIndianMarketStatus();
  const cleanSymbol = symbolQuery.trim().toUpperCase();

  interface StockRow {
    symbol: string;
    name: string;
    instrument_key: string;
    sector?: string;
  }
  let stockMeta: StockRow | null = null;

  if (instrumentKey) {
    const rows = await sql`
      SELECT symbol, name, instrument_key, sector
      FROM stocks
      WHERE instrument_key = ${instrumentKey}
      LIMIT 1;
    `;
    if (rows.length > 0) {
      stockMeta = rows[0] as unknown as StockRow;
    }
  }

  if (!stockMeta) {
    const rows = await sql`
      SELECT symbol, name, instrument_key, sector
      FROM stocks
      WHERE symbol = ${cleanSymbol}
      LIMIT 1;
    `;
    if (rows.length > 0) {
      stockMeta = rows[0] as unknown as StockRow;
    }
  }

  // Check watchlist_items if contract is an option or derivative
  if (!stockMeta && instrumentKey) {
    const rows = await sql`
      SELECT symbol, symbol as name, instrument_key, COALESCE(instrument_type, 'OPTION') as sector
      FROM watchlist_items
      WHERE instrument_key = ${instrumentKey}
      LIMIT 1;
    `;
    if (rows.length > 0) {
      stockMeta = rows[0] as unknown as StockRow;
    }
  }

  if (!stockMeta) {
    const rows = await sql`
      SELECT symbol, symbol as name, instrument_key, COALESCE(instrument_type, 'OPTION') as sector
      FROM watchlist_items
      WHERE symbol = ${cleanSymbol}
      LIMIT 1;
    `;
    if (rows.length > 0) {
      stockMeta = rows[0] as unknown as StockRow;
    }
  }

  // Fallback defaults if symbol not in stocks catalog
  const instKey = stockMeta?.instrument_key || instrumentKey || `NSE_EQ|${cleanSymbol}`;
  const symbolName = stockMeta?.name || cleanSymbol;
  const sector = stockMeta?.sector || (instKey.includes("_FO|") ? "Option Contract" : "NSE Equity");

  // 2. Fetch Quote, Previous Day Range, and Intraday 1-minute Candles concurrently
  const [quotesMap, levels, candles1m] = await Promise.all([
    getQuotesAndOI([instKey]),
    getPreviousDayRange(instKey),
    getIntradayCandles(instKey, "1m"),
  ]);

  // Resample 1m candles into 2m, 3m, 5m, 15m candles with institutional aggregation
  const candles2m = aggregateCandles(candles1m, 2);
  const candles3m = aggregateCandles(candles1m, 3);
  const candles5m = aggregateCandles(candles1m, 5);
  const candles15m = aggregateCandles(candles1m, 15);

  const rawQuote = quotesMap[instKey];
  const ohlc = rawQuote?.ohlc || {
    open: candles1m[candles1m.length - 1]?.open || 0,
    high: Math.max(...candles1m.map((c) => c.high), 0),
    low: Math.min(...candles1m.map((c) => c.low), 0),
    close: candles1m[0]?.close || 0,
  };

  const quote = {
    lastPrice: rawQuote?.lastPrice || candles1m[0]?.close || 0,
    oi: rawQuote?.oi || 0,
    volume: rawQuote?.volume || candles1m.reduce((acc, c) => acc + c.volume, 0),
    netChange: rawQuote?.netChange || 0,
    open: ohlc.open,
    high: ohlc.high,
    low: ohlc.low,
    close: ohlc.close,
  };

  // 3. Analyze Breakout across all 5 timeframes
  const breakout1m = analyzeIntradayFibBreakout(levels, candles1m, "1m");
  const breakout2m = analyzeIntradayFibBreakout(levels, candles2m, "2m");
  const breakout3m = analyzeIntradayFibBreakout(levels, candles3m, "3m");
  const breakout5m = analyzeIntradayFibBreakout(levels, candles5m, "5m");
  const breakout15m = analyzeIntradayFibBreakout(levels, candles15m, "15m");

  const hasAnyBreakoutToday =
    breakout1m.hasBroken ||
    breakout2m.hasBroken ||
    breakout3m.hasBroken ||
    breakout5m.hasBroken ||
    breakout15m.hasBroken;

  return {
    symbol: cleanSymbol,
    name: symbolName,
    instrumentKey: instKey,
    sector,
    quote,
    levels,
    timeframeBreakouts: {
      "1m": breakout1m,
      "2m": breakout2m,
      "3m": breakout3m,
      "5m": breakout5m,
      "15m": breakout15m,
    },
    hasAnyBreakoutToday,
    marketStatus,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Fetch past alerts from database
 */
export async function getScannerAlertHistory(watchlistId?: string, limit: number = 50) {
  if (watchlistId) {
    return sql`
      SELECT id, watchlist_id, symbol, instrument_key, timeframe, level_type, level_price, trigger_price, direction, open_interest, triggered_at
      FROM scanner_alerts
      WHERE watchlist_id = ${watchlistId}
      ORDER BY triggered_at DESC
      LIMIT ${limit};
    `;
  }

  return sql`
    SELECT id, watchlist_id, symbol, instrument_key, timeframe, level_type, level_price, trigger_price, direction, open_interest, triggered_at
    FROM scanner_alerts
    ORDER BY triggered_at DESC
    LIMIT ${limit};
  `;
}
