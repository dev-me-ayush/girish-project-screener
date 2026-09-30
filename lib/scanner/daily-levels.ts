import { sql } from "../db";
import { calculateFibLevels, FibLevels } from "../fibonacci";
import { getPreviousDayRange } from "../upstox";

export interface StockReferenceLevel extends FibLevels {
  symbol: string;
  instrument_key: string;
  instrument_type: "EQUITY" | "OPTION";
  session_date: string;
  average: number;
}

// Memory cache for session daily reference levels
const memoryDailyLevels = new Map<string, StockReferenceLevel>();
let cachedSessionDate: string = "";
let preloadedDate: string = "";

/**
 * Bulk pre-loads all daily reference levels for the session in a single database query.
 */
export async function preloadAllDailyReferenceLevels(sessionDate: string): Promise<void> {
  if (preloadedDate === sessionDate && memoryDailyLevels.size > 0) return;
  try {
    const dbRows = await sql`
      SELECT symbol, instrument_key, instrument_type, session_date, pdh, pdl, pdc, range, delta, ac38_2, dc38_2, average
      FROM daily_reference_levels
      WHERE session_date = ${sessionDate}::DATE;
    `;
    preloadedDate = sessionDate;
    cachedSessionDate = sessionDate;
    for (const row of dbRows) {
      const level: StockReferenceLevel = {
        symbol: row.symbol,
        instrument_key: row.instrument_key,
        instrument_type: row.instrument_type,
        session_date: sessionDate,
        pdh: Number(row.pdh),
        pdl: Number(row.pdl),
        pdc: Number(row.pdc),
        range: Number(row.range),
        ac38_2: Number(row.ac38_2),
        dc38_2: Number(row.dc38_2),
        average: Number(row.average),
      };
      memoryDailyLevels.set(`${row.symbol}_${sessionDate}`, level);
    }
  } catch (err) {
    console.error("DB bulk read error for daily reference levels:", err);
  }
}

/**
 * Loads daily reference levels for an instrument.
 * 1. Checks memory cache for current IST date.
 * 2. Checks Neon Postgres `daily_reference_levels` table (only if not preloaded).
 * 3. Falls back to quote OHLC or Upstox.
 */
export async function getDailyReferenceLevel(
  symbol: string,
  instrumentKey: string,
  instrumentType: "EQUITY" | "OPTION" = "EQUITY",
  sessionDate: string,
  fallbackOhlc?: { high?: number; low?: number; close?: number },
  allowNetworkFetch: boolean = false
): Promise<StockReferenceLevel> {
  // Clear memory cache on date change
  if (cachedSessionDate !== sessionDate) {
    memoryDailyLevels.clear();
    cachedSessionDate = sessionDate;
    preloadedDate = "";
  }

  const cacheKey = `${symbol}_${sessionDate}`;
  const memoryHit = memoryDailyLevels.get(cacheKey);
  if (memoryHit && memoryHit.range > 0) {
    return memoryHit;
  }

  // 1. Check Neon Postgres only if not already bulk preloaded
  if (preloadedDate !== sessionDate) {
    try {
      const dbRows = await sql`
        SELECT symbol, instrument_key, instrument_type, session_date, pdh, pdl, pdc, range, delta, ac38_2, dc38_2, average
        FROM daily_reference_levels
        WHERE symbol = ${symbol} AND session_date = ${sessionDate}::DATE
        LIMIT 1;
      `;

      if (dbRows.length > 0) {
      const row = dbRows[0];
      const level: StockReferenceLevel = {
        symbol: row.symbol,
        instrument_key: row.instrument_key,
        instrument_type: row.instrument_type,
        session_date: sessionDate,
        pdh: Number(row.pdh),
        pdl: Number(row.pdl),
        pdc: Number(row.pdc),
        range: Number(row.range),
        ac38_2: Number(row.ac38_2),
        dc38_2: Number(row.dc38_2),
        average: Number(row.average),
      };
        memoryDailyLevels.set(cacheKey, level);
        return level;
      }
    } catch (err) {
      console.error(`DB read error for daily levels of ${symbol}:`, err);
    }
  }

  // 2. Compute from quote OHLC if provided
  if (fallbackOhlc && fallbackOhlc.close && fallbackOhlc.high && fallbackOhlc.low && fallbackOhlc.high > fallbackOhlc.low) {
    const pdh = fallbackOhlc.high;
    const pdl = fallbackOhlc.low;
    const pdc = fallbackOhlc.close;
    const fib = calculateFibLevels(pdh, pdl, pdc);
    const average = Number(((pdh + pdl + pdc) / 3).toFixed(2));

    const computedLevel: StockReferenceLevel = {
      symbol,
      instrument_key: instrumentKey,
      instrument_type: instrumentType,
      session_date: sessionDate,
      pdh,
      pdl,
      pdc,
      range: fib.range,
      ac38_2: fib.ac38_2,
      dc38_2: fib.dc38_2,
      average,
    };
    memoryDailyLevels.set(cacheKey, computedLevel);
    return computedLevel;
  }

  // 3. Fallback to Upstox historical daily candle only if explicitly permitted (non-batch operations)
  if (allowNetworkFetch) {
    try {
      const upstoxRange = await getPreviousDayRange(instrumentKey);
      const pdh = upstoxRange.pdh;
      const pdl = upstoxRange.pdl;
      const pdc = upstoxRange.pdc;
      const fib = calculateFibLevels(pdh, pdl, pdc);
      const average = Number(((pdh + pdl + pdc) / 3).toFixed(2));
      const delta = Number((fib.range * 0.382 * 1.236).toFixed(2));

      const newLevel: StockReferenceLevel = {
        symbol,
        instrument_key: instrumentKey,
        instrument_type: instrumentType,
        session_date: sessionDate,
        pdh,
        pdl,
        pdc,
        range: fib.range,
        ac38_2: fib.ac38_2,
        dc38_2: fib.dc38_2,
        average,
      };

      memoryDailyLevels.set(cacheKey, newLevel);
      if (fib.range > 0 && pdc > 0) {
        sql`
          INSERT INTO daily_reference_levels (
            symbol, instrument_key, instrument_type, session_date,
            pdh, pdl, pdc, range, delta, ac38_2, dc38_2, average
          ) VALUES (
            ${symbol}, ${instrumentKey}, ${instrumentType}, ${sessionDate}::DATE,
            ${pdh}, ${pdl}, ${pdc}, ${fib.range}, ${delta}, ${fib.ac38_2}, ${fib.dc38_2}, ${average}
          )
          ON CONFLICT (symbol, session_date) DO NOTHING;
        `.catch((e) => console.error(`Error saving daily level for ${symbol}:`, e));
      }
      return newLevel;
    } catch {
      // Fall through to empty level
    }
  }

  const emptyFib = calculateFibLevels(0, 0, 0);
  return {
    symbol,
    instrument_key: instrumentKey,
    instrument_type: instrumentType,
    session_date: sessionDate,
    average: 0,
    ...emptyFib,
  };
}
