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
let preloadedAt: number = 0;
// Bulk preload refresh cadence: warmup persists rows continuously, so the
// scan's snapshot must refresh periodically to pick newly stored levels up
// promptly instead of serving a stale first-scan snapshot all session.
const PRELOAD_TTL_MS = 5 * 60 * 1000;

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
 * Refreshes at most every PRELOAD_TTL_MS so rows persisted by the session
 * warmup (or another instance) are picked up promptly by scans.
 */
export async function preloadAllDailyReferenceLevels(sessionDate: string): Promise<void> {
  const now = Date.now();
  if (preloadedDate === sessionDate && memoryDailyLevels.size > 0 && now - preloadedAt < PRELOAD_TTL_MS) return;
  try {
    const dbRows = await sql`
      SELECT symbol, instrument_key, instrument_type, session_date, pdh, pdl, pdc, range, delta, ac38_2, dc38_2, average
      FROM daily_reference_levels
      WHERE session_date = ${sessionDate}::DATE;
    `;
    preloadedDate = sessionDate;
    cachedSessionDate = sessionDate;
    preloadedAt = now;
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
 * Forces the next scan to re-run the bulk preload (e.g. right after a
 * warmup pass completes), so freshly persisted levels appear immediately
 * instead of waiting for the TTL refresh.
 */
export function invalidatePreload(): void {
  preloadedAt = 0;
}

/**
 * Fast read path for scans: memory cache, then Neon Postgres.
 *
 * Performs ZERO network calls so the 1-minute scan stays bounded no matter
 * how many symbols are missing. Symbols with no stored row resolve to zero
 * levels (rendered as "--") WITHOUT being cached, so the periodic bulk
 * preload (or the warmup's direct write) picks up their real values as soon
 * as they are persisted — levels populate in bulk instead of trickling in
 * one symbol at a time.
 *
 * Previous-session history is immutable during a trading session, so stored
 * rows are safe to keep in memory for the session.
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
    preloadedAt = 0;
  }

  const cacheKey = `${symbol}_${sessionDate}`;
  const memoryHit = memoryDailyLevels.get(cacheKey);
  if (memoryHit) {
    return memoryHit;
  }

  // When a bulk preload has already snapshotted this session, it contains
  // every stored row: a miss here means genuinely not warmed yet. Return
  // empty WITHOUT caching, so the next TTL refresh surfaces the warmed row.
  if (preloadedDate === sessionDate) {
    return emptyLevel(symbol, instrumentKey, instrumentType, sessionDate);
  }

  // First-load path (no bulk snapshot yet in this process): single-row check.
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

  // No stored row yet: return empty WITHOUT caching. The warmup persists
  // the real previous-session values asynchronously and the bulk preload
  // picks them up on its next refresh.
  return emptyLevel(symbol, instrumentKey, instrumentType, sessionDate);
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
 * Bounded-concurrency worker pool (default 6) with pacing between
 * dispatches and the built-in 429 retry in the Upstox client, so a full
 * ~2,700-symbol universe fills in minutes instead of trickling in one
 * symbol per second across most of the session. Resumable: re-runs only
 * attempt symbols still missing from the database.
 */
export async function ensureSessionLevels(
  sessionDate: string,
  instruments: SessionWarmupInstrument[],
  opts?: { delayMs?: number; maxSymbols?: number; concurrency?: number }
): Promise<SessionWarmupStats> {
  const delayMs = opts?.delayMs ?? 250;
  const maxSymbols = opts?.maxSymbols ?? Number.POSITIVE_INFINITY;
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 6, 12));

  if (cachedSessionDate !== sessionDate) {
    memoryDailyLevels.clear();
    cachedSessionDate = sessionDate;
    preloadedDate = "";
    preloadedAt = 0;
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
  let cursor = 0;

  async function fillOne(inst: SessionWarmupInstrument): Promise<void> {
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
        // do NOT cache the empty level — the next bulk preload simply
        // skips it again until real history exists.
        failed++;
      }
    } catch (err) {
      console.error(`Session warmup fetch failed for ${inst.symbol}:`, err);
      failed++;
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      const n = cursor++;
      if (n >= missing.length) return;
      await fillOne(missing[n]);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const workers = Math.min(concurrency, Math.max(missing.length, 1));
  await Promise.all(Array.from({ length: workers }, () => worker()));

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
  opts?: { delayMs?: number; maxSymbols?: number; concurrency?: number }
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
