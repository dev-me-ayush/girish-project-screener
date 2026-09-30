import { sql } from "../db";
import { StockReferenceLevel } from "./daily-levels";

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
  isFreshCrossing: boolean;
}

// In-memory session tracking for each symbol's breakout state
interface SymbolSessionState {
  currentDirection: BreakoutDirection;
  breachCount: number;
  firstBreachTime: string | null;
  latestBreachTime: string | null;
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
            ${a.symbol}, ${a.instrument_key}, ${a.instrument_type}, '5m',
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
 * Evaluates whether an instrument has broken above AC 38.2% or below DC 38.2% on a 5m interval,
 * tracking state transitions, breach counts, and inserting lean alerts into Neon Postgres.
 */
export async function evaluate5mBreakout(
  symbol: string,
  ltp: number,
  levels: StockReferenceLevel,
  currentTimeIST: string,
  isLiveMarket: boolean = true
): Promise<BreakoutEvaluationResult> {
  const { ac38_2, dc38_2, session_date, instrument_key, instrument_type } = levels;
  let state = memoryState.get(symbol);

  // Reset state if session date rolled over
  if (!state || state.sessionDate !== session_date) {
    state = {
      currentDirection: "INSIDE",
      breachCount: 0,
      firstBreachTime: null,
      latestBreachTime: null,
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
      isFreshCrossing: false,
    };
  }

  let newDirection: BreakoutDirection = "INSIDE";
  let status: "Up Breakout" | "Low Breakout" | "Inside Range" = "Inside Range";
  let levelName: string | null = null;
  let levelPrice: number | null = null;

  if (ac38_2 > 0 && ltp > ac38_2) {
    newDirection = "UP";
    status = "Up Breakout";
    levelName = "AC 38.2%";
    levelPrice = ac38_2;
  } else if (dc38_2 > 0 && ltp < dc38_2) {
    newDirection = "LOW";
    status = "Low Breakout";
    levelName = "DC 38.2%";
    levelPrice = dc38_2;
  }

  const isFreshCrossing = isLiveMarket && newDirection !== "INSIDE" && state.currentDirection !== newDirection;

  if (isFreshCrossing) {
    state.breachCount += 1;
    if (!state.firstBreachTime) {
      state.firstBreachTime = currentTimeIST;
    }
    state.latestBreachTime = currentTimeIST;
    state.currentDirection = newDirection;

    // Buffer alert into memory queue for batched ingestion
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
      breakout_time: currentTimeIST,
    });
  } else if (isLiveMarket && newDirection === "INSIDE" && state.currentDirection !== "INSIDE") {
    // Pullback inside range: update state to INSIDE but preserve prior breach counts & times
    state.currentDirection = "INSIDE";
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
    isFreshCrossing,
  };
}
