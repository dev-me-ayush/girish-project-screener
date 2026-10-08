import { sql } from "../db";
import { StockReferenceLevel } from "./daily-levels";
import { getCandleCloseStampIST } from "./market-calendar";
import { getIntradayCandles } from "../upstox";

export type BreakoutDirection = "UP" | "LOW" | "INSIDE";

export interface BreakoutEvaluationResult {
  symbol: string;
  status: "Up Breakout" | "Low Breakout" | "Inside Range";
  direction: BreakoutDirection;
  levelName: string | null;
  levelPrice: number | null;
  triggerPrice: number;
  breachCount: number;
  firstBreachTime: string | null;
  latestBreachTime: string | null;
  breachTimes: string[];
  isFreshCrossing: boolean;
}

// In-memory session tracking for each symbol's breakout state
interface SymbolSessionState {
  currentDirection: BreakoutDirection;
  breachCount: number;
  firstBreachTime: string | null;
  latestBreachTime: string | null;
  breachTimes: string[];
  sessionDate: string;
}

interface PendingAlert {
  symbol: string;
  instrument_key: string;
  instrument_type: "EQUITY" | "OPTION";
  level_name: string;
  level_price: number;
  trigger_price: number;
  direction: string;
  breach_count: number;
  session_date: string;
  breakout_time: string;
}

const memoryState = new Map<string, SymbolSessionState>();
const pendingAlerts: PendingAlert[] = [];

// Tracks which session dates have been bulk-hydrated from Postgres so cold
// starts / restarts / scaled instances don't re-stamp late poll times.
let hydratedSessionDate = "";
let hydrationInFlight: Promise<void> | null = null;

function formatCandleStampIST(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const hh = m.hour === "24" ? "00" : m.hour;
  return `${hh}:${m.minute}:${m.second}`;
}

/**
 * Bulk-hydrates in-memory breakout state from persisted session alerts.
 * Single query per session: on cold start the memory map is empty, so the
 * first scan that actually sees a breakout would otherwise stamp the late
 * poll time (e.g. 09:55) instead of the true first break (e.g. 09:15).
 */
export async function ensureBreakoutStateHydrated(sessionDate: string): Promise<void> {
  if (hydratedSessionDate === sessionDate) return;
  if (hydrationInFlight) {
    await hydrationInFlight;
    return;
  }
  hydrationInFlight = (async () => {
  try {
    const rows = (await sql`
      SELECT symbol, breach_count, breakout_time, direction
      FROM scanner_alerts
      WHERE session_date = ${sessionDate}::DATE
      ORDER BY symbol ASC, breakout_time ASC;
    `) as Array<{ symbol: string; breach_count: number; breakout_time: string; direction: string }>;
    for (const r of rows) {
      const key = String(r.symbol);
      let st = memoryState.get(key);
      if (!st || st.sessionDate !== sessionDate) {
        st = {
          currentDirection: "INSIDE",
          breachCount: 0,
          firstBreachTime: null,
          latestBreachTime: null,
          breachTimes: [],
          sessionDate,
        };
        memoryState.set(key, st);
      }
      const t = String(r.breakout_time);
      if (!st.breachTimes.includes(t)) st.breachTimes.push(t);
      if (!st.firstBreachTime) st.firstBreachTime = t;
      st.latestBreachTime = t;
      const c = Number(r.breach_count) || st.breachTimes.length;
      if (c > st.breachCount) st.breachCount = c;
      // Restore the live side from the latest persisted alert. Without
      // this, every restart/redeploy/scale-out starts at INSIDE and the
      // first poll re-fires a phantom Trigger #(n+1) for every symbol
      // still holding outside its band (e.g. the 10:46 IST storm).
      const d = String(r.direction || "").toUpperCase();
      st.currentDirection = d === "BULLISH" ? "UP" : d === "BEARISH" ? "LOW" : st.currentDirection;
    }
  } catch (err) {
    console.error("Breakout state hydration failed:", err);
  }
  hydratedSessionDate = sessionDate;
  })();
  try {
    await hydrationInFlight;
  } finally {
    hydrationInFlight = null;
  }
}

/**
 * Resolves the TRUE first-breakout candle from Upstox 1m intraday history.
 *
 * The live poll only knows the wall-clock minute it first OBSERVED the
 * breakout. When levels/quotes arrive late (session warmup for ~2,700
 * symbols takes minutes) or the process restarted, that observation time
 * is late (e.g. 09:55) even though the price gapped/broke at the open
 * (e.g. 09:15). Scanning chronological 1m candles finds the actual first
 * candle whose close crossed the level; a gap-open beyond the level
 * returns the first candle's own stamp (09:15:00).
 *
 * Burst guard: hundreds of symbols can breach in the same scan (each newly
 * warmed symbol whose price already sits outside its band). Intraday
 * fetches are capped at MAX_TRUE_STAMP_INFLIGHT concurrent Upstox calls;
 * overflow falls back to the poll stamp and is corrected later by the
 * backfill batch (scripts/backfill-true-breakout-times.mjs).
 */
const MAX_TRUE_STAMP_INFLIGHT = 4;
let trueStampInflight = 0;

export async function resolveTrueBreakoutStamp(
  instrumentKey: string,
  levelPrice: number,
  direction: BreakoutDirection,
  fallbackStamp: string
): Promise<string> {
  if (trueStampInflight >= MAX_TRUE_STAMP_INFLIGHT) return fallbackStamp;
  trueStampInflight++;
  try {
    const candles = await getIntradayCandles(instrumentKey, "1m");
    if (!candles || candles.length === 0) return fallbackStamp;
    const chrono = [...candles].reverse();
    for (const c of chrono) {
      if (direction === "UP" && c.close > levelPrice) {
        return formatCandleStampIST(c.timestamp);
      }
      if (direction === "LOW" && c.close < levelPrice) {
        return formatCandleStampIST(c.timestamp);
      }
    }
    return fallbackStamp;
  } catch {
    return fallbackStamp;
  } finally {
    trueStampInflight--;
  }
}

/**
 * Flushes buffered alerts into Neon Postgres in controlled batches of 25.
 */
export async function flushPendingAlerts(): Promise<void> {
  if (pendingAlerts.length === 0) return;
  const toInsert = pendingAlerts.splice(0, pendingAlerts.length);

  const BATCH_SIZE = 25;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map((a) =>
        sql`
          INSERT INTO scanner_alerts (
            symbol, instrument_key, instrument_type, timeframe,
            level_name, level_type, level_price, trigger_price, direction,
            breach_count, session_date, breakout_time
          ) VALUES (
            ${a.symbol}, ${a.instrument_key}, ${a.instrument_type}, '1m',
            ${a.level_name}, ${a.level_name}, ${a.level_price}, ${a.trigger_price}, ${a.direction},
            ${a.breach_count}, ${a.session_date}::DATE, ${a.breakout_time}
          )
          ON CONFLICT DO NOTHING;
        `.catch((err) => console.error(`Error saving alert for ${a.symbol}:`, err))
      )
    );
  }
}

/**
 * Candle-close breakout evaluation on the 1m interval (candle-close trigger ONLY).
 *
 * Each 1-minute poll runs just after the wall-clock minute boundary and the
 * poll LTP is treated as the just-closed candle's close. The alert is stamped
 * with the candle CLOSE time (`HH:MM:00`, floored from poll time), never the
 * intra-minute tick/wait time — e.g. a cross during the 10:23 candle surfaces
 * as "10:24:00". At most one alert fires per candle per symbol, so repeated
 * polls inside the same minute cannot double-alert, while crosses in different
 * candles each produce their own alert.
 */
export async function evaluateBreakout(
  symbol: string,
  ltp: number,
  levels: StockReferenceLevel,
  currentTimeIST: string,
  isLiveMarket: boolean = true
): Promise<BreakoutEvaluationResult> {
  const { ac38_2, dc38_2, session_date, instrument_key, instrument_type } = levels;
  // Candle-close trigger: normalize poll/wait time to the closed candle's
  // close stamp (HH:MM:00). All state + persisted alerts use this stamp.
  const candleStamp = getCandleCloseStampIST(currentTimeIST);
  // Recover persisted session state once per session so restarts don't
  // re-stamp Trigger #1 at a late poll time.
  await ensureBreakoutStateHydrated(session_date);
  let state = memoryState.get(symbol);

  // Reset state if session date rolled over
  if (!state || state.sessionDate !== session_date) {
    state = {
      currentDirection: "INSIDE",
      breachCount: 0,
      firstBreachTime: null,
      latestBreachTime: null,
      breachTimes: [],
      sessionDate: session_date,
    };
    memoryState.set(symbol, state);
  }

  // Off-market hours: Alerts and breakout states activate strictly during live market hours (09:15 - 15:30 IST)
  if (!isLiveMarket) {
    return {
      symbol,
      status: "Inside Range",
      direction: "INSIDE",
      levelName: null,
      levelPrice: null,
      triggerPrice: ltp,
      breachCount: 0,
      firstBreachTime: null,
      latestBreachTime: null,
      breachTimes: [],
      isFreshCrossing: false,
    };
  }

  let newDirection: BreakoutDirection = "INSIDE";
  let status: "Up Breakout" | "Low Breakout" | "Inside Range" = "Inside Range";
  let levelName: string | null = null;
  let levelPrice: number | null = null;

  // Strict ltp > 0 check to permanently prevent illiquid/zero-quote symbols from falsely triggering breakdowns
  if (ltp > 0 && ac38_2 > 0 && ltp > ac38_2) {
    newDirection = "UP";
    status = "Up Breakout";
    levelName = "AC 38.2%";
    levelPrice = ac38_2;
  } else if (ltp > 0 && dc38_2 > 0 && ltp < dc38_2) {
    newDirection = "LOW";
    status = "Low Breakout";
    levelName = "DC 38.2%";
    levelPrice = dc38_2;
  }

  const isFreshCrossing = isLiveMarket && newDirection !== "INSIDE" && state.currentDirection !== newDirection;

  // Candle-close dedup: at most one alert per closed candle per symbol.
  // A repeat poll inside the same minute (same candleStamp) never re-fires,
  // while a cross in a later candle fires normally (each occurrence logged).
  const alreadyAlertedThisCandle = state.breachTimes.includes(candleStamp);
  const shouldAlert = isFreshCrossing && !alreadyAlertedThisCandle;

  if (shouldAlert) {
    // First breach of the session: ground the stamp in 1m candle history,
    // not the late poll minute. A gap-open below DC / above AC resolves to
    // the opening candle (09:15:00) instead of e.g. 09:55:00.
    let effectiveStamp = candleStamp;
    if (state.breachTimes.length === 0 && levelPrice !== null) {
      const trueStamp = await resolveTrueBreakoutStamp(
        instrument_key,
        levelPrice,
        newDirection,
        candleStamp
      );
      effectiveStamp = trueStamp;
    }
    // Restored state already contains this true stamp (e.g. 09:15 persisted
    // by another instance): adopt it for display without double-counting.
    if (state.breachTimes.includes(effectiveStamp)) {
      state.currentDirection = newDirection;
      if (!state.firstBreachTime) state.firstBreachTime = effectiveStamp;
      state.latestBreachTime = effectiveStamp;
      return {
        symbol,
        status,
        direction: newDirection,
        levelName,
        levelPrice,
        triggerPrice: ltp,
        breachCount: state.breachCount,
        firstBreachTime: state.firstBreachTime,
        latestBreachTime: state.latestBreachTime,
        breachTimes: [...state.breachTimes],
        isFreshCrossing: false,
      };
    }
    state.breachCount += 1;
    if (!state.firstBreachTime) {
      state.firstBreachTime = effectiveStamp;
    }
    state.latestBreachTime = effectiveStamp;
    if (!state.breachTimes.includes(effectiveStamp)) {
      state.breachTimes.push(effectiveStamp);
    } else {
      // Same-candle re-cross after hydration: keep count, don't duplicate.
      state.latestBreachTime = effectiveStamp;
    }
    state.currentDirection = newDirection;

    // Buffer alert into memory queue for batched ingestion as distinct event
    const directionLabel = newDirection === "UP" ? "BULLISH" : "BEARISH";
    pendingAlerts.push({
      symbol,
      instrument_key,
      instrument_type,
      level_name: levelName!,
      level_price: levelPrice!,
      trigger_price: ltp,
      direction: directionLabel,
      breach_count: state.breachCount,
      session_date,
      breakout_time: effectiveStamp,
    });
  } else if (isLiveMarket && newDirection === "INSIDE" && state.currentDirection !== "INSIDE") {
    // Pullback inside range: update state to INSIDE but preserve prior breach counts & times
    state.currentDirection = "INSIDE";
  } else if (isLiveMarket && newDirection !== "INSIDE" && state.currentDirection !== newDirection) {
    // Same-candle repeat (tick re-poll): track the latest side for display
    // without logging a duplicate alert for the same closed candle.
    state.currentDirection = newDirection;
  }

  return {
    symbol,
    status,
    direction: newDirection,
    levelName,
    levelPrice,
    triggerPrice: ltp,
    breachCount: isLiveMarket ? state.breachCount : 0,
    firstBreachTime: isLiveMarket ? state.firstBreachTime : null,
    latestBreachTime: isLiveMarket ? state.latestBreachTime : null,
    breachTimes: isLiveMarket ? [...state.breachTimes] : [],
    isFreshCrossing: shouldAlert,
  };
}

export const evaluate1mBreakout = evaluateBreakout;
export const evaluate5mBreakout = evaluateBreakout;
