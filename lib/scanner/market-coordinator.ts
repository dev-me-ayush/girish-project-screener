import { sql } from "../db";
import { getMarketSessionStatus, MarketSessionStatus } from "./market-calendar";
import { getActiveAtmOptionsContracts, ResolvedOptionContract } from "./options-resolver";
import { getDailyReferenceLevel, preloadAllDailyReferenceLevels, StockReferenceLevel } from "./daily-levels";
import { fetchBatchQuotes, LiveMarketQuote } from "./batch-quotes";
import { evaluate5mBreakout, flushPendingAlerts, BreakoutEvaluationResult } from "./breakout-engine";

export interface UnifiedScannedInstrument {
  symbol: string;
  instrument_key: string;
  instrument_type: "EQUITY" | "OPTION";
  underlying?: string;
  strike_price?: number;
  option_type?: "CE" | "PE";
  expiry?: string;
  ltp: number;
  net_change: number;
  volume: number;
  oi: number;
  levels: StockReferenceLevel;
  breakout: BreakoutEvaluationResult;
}

export interface MarketScanPayload {
  session: MarketSessionStatus;
  totalInstruments: number;
  equitiesCount: number;
  optionsCount: number;
  upBreakoutsCount: number;
  lowBreakoutsCount: number;
  scannedAt: string;
  instruments: UnifiedScannedInstrument[];
}

let cachedPayload: { data: MarketScanPayload; timestamp: number } | null = null;
const CACHE_TTL_MS = 50 * 1000; // 50 seconds (1-minute cadence)

// In-memory cache for static stocks catalog to eliminate Neon DB query overhead on 1m scans
let cachedStocks: Array<{ symbol: string; instrument_key: string }> | null = null;
let cachedStocksTimestamp = 0;
const STOCKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * High-speed 1-minute Market Coordinator for 2,732 instruments (2,680 equities + 52 ATM options)
 */
export async function runFullMarketScan(forceRefresh: boolean = false): Promise<MarketScanPayload> {
  const now = Date.now();
  if (!forceRefresh && cachedPayload && now - cachedPayload.timestamp < CACHE_TTL_MS) {
    return cachedPayload.data;
  }

  const session = getMarketSessionStatus();

  // 1. Load all 2,680 equities (reusing in-memory cache to prevent per-minute DB query load)
  if (!cachedStocks || now - cachedStocksTimestamp > STOCKS_CACHE_TTL_MS) {
    const dbStocks = await sql`
      SELECT symbol, instrument_key
      FROM stocks
      ORDER BY symbol ASC;
    `;
    cachedStocks = dbStocks as Array<{ symbol: string; instrument_key: string }>;
    cachedStocksTimestamp = now;
  }
  const dbStocks = cachedStocks;

  // 2. Load 52 active ATM options
  const optionsContracts: ResolvedOptionContract[] = await getActiveAtmOptionsContracts();

  // 3. Assemble all instrument keys for batch quotes
  const allKeys: string[] = [
    ...dbStocks.map((s) => s.instrument_key as string),
    ...optionsContracts.map((o) => o.instrument_key),
  ];

  // 4. Execute 6-batch quotes against Upstox
  const quotesMap: Map<string, LiveMarketQuote> = await fetchBatchQuotes(allKeys);

  // 5. Pre-load all session daily reference levels into memory cache in 1 single bulk query
  await preloadAllDailyReferenceLevels(session.sessionDate);

  // 6. Hydrate daily levels & breakout status concurrently
  const items: UnifiedScannedInstrument[] = [];
  let upCount = 0;
  let lowCount = 0;

  // Process Equities
  for (const s of dbStocks) {
    const symbol = s.symbol as string;
    const key = s.instrument_key as string;
    const q = quotesMap.get(key) || quotesMap.get(symbol);
    const ltp = q ? q.last_price : 0;

    const levels = await getDailyReferenceLevel(
      symbol,
      key,
      "EQUITY",
      session.sessionDate,
      q ? { high: q.high, low: q.low, close: q.close } : undefined,
      false
    );
    const breakout = await evaluate5mBreakout(symbol, ltp, levels, session.currentTimeIST, session.isMarketOpen);

    if (breakout.direction === "UP") upCount++;
    if (breakout.direction === "LOW") lowCount++;

    items.push({
      symbol,
      instrument_key: key,
      instrument_type: "EQUITY",
      ltp,
      net_change: q ? q.net_change : 0,
      volume: q ? q.volume : 0,
      oi: q ? q.oi : 0,
      levels,
      breakout,
    });
  }

  // Process Options
  for (const opt of optionsContracts) {
    const q = quotesMap.get(opt.instrument_key) || quotesMap.get(opt.symbol);
    const ltp = q ? q.last_price : 0;

    const levels = await getDailyReferenceLevel(
      opt.symbol,
      opt.instrument_key,
      "OPTION",
      session.sessionDate,
      q ? { high: q.high, low: q.low, close: q.close } : undefined,
      false
    );
    const breakout = await evaluate5mBreakout(opt.symbol, ltp, levels, session.currentTimeIST, session.isMarketOpen);

    if (breakout.direction === "UP") upCount++;
    if (breakout.direction === "LOW") lowCount++;

    items.push({
      symbol: opt.symbol,
      instrument_key: opt.instrument_key,
      instrument_type: "OPTION",
      underlying: opt.underlying,
      strike_price: opt.strike_price,
      option_type: opt.option_type,
      expiry: opt.expiry,
      ltp,
      net_change: q ? q.net_change : 0,
      volume: q ? q.volume : 0,
      oi: q ? q.oi : 0,
      levels,
      breakout,
    });
  }

  const payload: MarketScanPayload = {
    session,
    totalInstruments: items.length,
    equitiesCount: dbStocks.length,
    optionsCount: optionsContracts.length,
    upBreakoutsCount: upCount,
    lowBreakoutsCount: lowCount,
    scannedAt: new Date().toISOString(),
    instruments: items,
  };

  // 7. Flush any newly generated alerts into Neon Postgres safely in batches
  await flushPendingAlerts();

  cachedPayload = { data: payload, timestamp: now };
  return payload;
}
