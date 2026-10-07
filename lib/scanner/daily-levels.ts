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

function buildLevel(
  symbol: string,
  instrumentKey: string,
  instrumentType: "EQUITY" | "OPTION",
  sessionDate: string,
  pdh: number,
  pdl: number,
  pdc: number
): StockReferenceLevel {
  const fib = calculateFibLevels(pdh, pdl, pdc);
  return {
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
    average: Number(((pdh + pdl + pdc) / 3).toFixed(2)),
  };
}

function emptyLevel(
  symbol: string,
  instrumentKey: string,
  instrumentType: "EQUITY" | "OPTION",
  sessionDate: string
): StockReferenceLevel {
  return { ...buildLevel(symbol, instrumentKey, instrumentType, sessionDate, 0, 0, 0), average: 0 };
}

async function persistLevel(level: StockReferenceLevel): Promise<void> {
  const delta = Number((level.range * 0.382 * 1.236).toFixed(2));
  await sql`
    INSERT INTO daily_reference_levels (
      symbol, instrument_key, instrument_type, session_date,
      pdh, pdl, pdc, range, delta, ac38_2, dc38_2, average
    ) VALUES (
      ${level.symbol}, ${level.instrument_key}, ${level.instrument_type}, ${level.session_date}::DATE,
      ${level.pdh}, ${level.pdl}, ${level.pdc}, ${level.range}, ${delta}, ${level.ac38_2}, ${level.dc38_2}, ${level.average}
    )
    ON CONFLICT (symbol, session_date) DO NOTHING;
  `;
}

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
 * Fast read path for scans: memory cache, then Neon Postgres.
 *
 * Deliberately performs ZERO network calls so the 1-minute scan stays
 * bounded no matter how many symbols are missing. Symbols with no stored
 * row resolve to zero levels (rendered as "--") until the session warmup
 * (`ensureSessionLevels`) persists their previous-session values.
 *
 * Previous-session history is immutable during a trading session, so even
 * zero results are cached in memory for the session: refetching cannot
 * produce different values, only wasted Upstox calls.
 */
export async function getDailyReferenceLevel(
  symbol: string,
  instrumentKey: string,
  instrumentType: "EQUITY" | "OPTION" = "EQUITY",
  sessionDate: string
): Promise<StockReferenceLevel> {
  // Clear memory cache on date change
  if (cachedSessionDate !== sessionDate) {
    memoryDailyLevels.clear();
    cachedSessionDate = sessionDate;
    preloadedDate = "";
  }

  const cacheKey = `${symbol}_${sessionDate}`;
  const memoryHit = memoryDailyLevels.get(cacheKey);
  if (memoryHit) {
    return memoryHit;
  }

  // Check Neon Postgres only if not already bulk preloaded
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

  // No stored row: return (and session-cache) an empty level. The warmup
  // fills the real previous-session values asynchronously.
  const empty = emptyLevel(symbol, instrumentKey, instrumentType, sessionDate);
  memoryDailyLevels.set(cacheKey, empty);
  return empty;
}

export interface SessionWarmupInstrument {
  symbol: string;
  instrument_key: string;
  instrument_type: "EQUITY" | "OPTION";
}

export interface SessionWarmupStats {
  sessionDate: string;
  requested: number;
  alreadyStored: number;
  filled: number;
  failed: number;
  remaining: number;
}

/**
 * Session warmup (the ONLY network fill path): resolves the previous
 * completed trading session's PDH/PDL/PDC from Upstox historical daily
 * candles for every instrument missing a stored row, then persists them.
 *
 * Sequential with a ~1s pace (~60 req/min) to stay under Upstox rate
 * limits alongside the 1-minute quote cycle. Resumable: re-runs only
 * attempt symbols still missing from the database.
 */
export async function ensureSessionLevels(
  sessionDate: string,
  instruments: SessionWarmupInstrument[],
  opts?: { delayMs?: number; maxSymbols?: number }
): Promise<SessionWarmupStats> {
  const delayMs = opts?.delayMs ?? 1000;
  const maxSymbols = opts?.maxSymbols ?? Number.POSITIVE_INFINITY;

  if (cachedSessionDate !== sessionDate) {
    memoryDailyLevels.clear();
    cachedSessionDate = sessionDate;
    preloadedDate = "";
  }

  const names = instruments.map((i) => i.symbol);
  let stored = new Set<string>();
  try {
    const rows = await sql`
      SELECT symbol FROM daily_reference_levels
      WHERE session_date = ${sessionDate}::DATE AND symbol = ANY(${names});
    `;
    stored = new Set(rows.map((r) => String(r.symbol)));
  } catch (err) {
    console.error("Session warmup DB check failed:", err);
  }

  const missing = instruments.filter((i) => !stored.has(i.symbol)).slice(0, maxSymbols);
  let filled = 0;
  let failed = 0;

  for (let n = 0; n < missing.length; n++) {
    const inst = missing[n];
    try {
      const range = await getPreviousDayRange(inst.instrument_key);
      if (range.range > 0 && range.pdc > 0) {
        const level = buildLevel(
          inst.symbol,
          inst.instrument_key,
          inst.instrument_type,
          sessionDate,
          range.pdh,
          range.pdl,
          range.pdc
        );
        try {
          await persistLevel(level);
        } catch (dbErr) {
          console.error(`Error saving daily level for ${inst.symbol}:`, dbErr);
        }
        memoryDailyLevels.set(`${inst.symbol}_${sessionDate}`, level);
        filled++;
      } else {
        // No previous-session history (e.g. freshly listed weekly option):
        // session-cache the empty level so scans render "--" without refetching.
        memoryDailyLevels.set(
          `${inst.symbol}_${sessionDate}`,
          emptyLevel(inst.symbol, inst.instrument_key, inst.instrument_type, sessionDate)
        );
        failed++;
      }
    } catch (err) {
      console.error(`Session warmup fetch failed for ${inst.symbol}:`, err);
      failed++;
    }
    if (n < missing.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    sessionDate,
    requested: instruments.length,
    alreadyStored: stored.size,
    filled,
    failed,
    remaining: missing.length - filled - failed,
  };
}

const warmupInFlight = new Map<string, Promise<SessionWarmupStats>>();

/**
 * Single-flight trigger for background warmup: concurrent callers share one
 * pass per session; the next pass (after completion) retries leftovers.
 * Never throws — rejections resolve to a failed-stats object.
 */
export function triggerSessionWarmup(
  sessionDate: string,
  instruments: SessionWarmupInstrument[],
  opts?: { delayMs?: number; maxSymbols?: number }
): Promise<SessionWarmupStats> {
  const existing = warmupInFlight.get(sessionDate);
  if (existing) return existing;
  const run = ensureSessionLevels(sessionDate, instruments, opts)
    .catch((err) => {
      console.error("Session warmup pass failed:", err);
      return {
        sessionDate,
        requested: instruments.length,
        alreadyStored: 0,
        filled: 0,
        failed: instruments.length,
        remaining: instruments.length,
      } satisfies SessionWarmupStats;
    })
    .finally(() => {
      if (warmupInFlight.get(sessionDate) === run) {
        warmupInFlight.delete(sessionDate);
      }
    });
  warmupInFlight.set(sessionDate, run);
  return run;
}
