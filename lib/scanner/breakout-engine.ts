import { sql } from "../db";
import { StockReferenceLevel } from "./daily-levels";
import { getCandleCloseStampIST } from "./market-calendar";

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
    state.breachCount += 1;
    if (!state.firstBreachTime) {
      state.firstBreachTime = candleStamp;
    }
    state.latestBreachTime = candleStamp;
    state.breachTimes.push(candleStamp);
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
      breakout_time: candleStamp,
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
