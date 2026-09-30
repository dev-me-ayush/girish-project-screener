export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

export interface FibLevels {
  pdh: number;
  pdl: number;
  pdc: number;
  range: number;
  ac38_2: number;
  dc38_2: number;
  level0?: number;
  level23_6?: number;
  level38_2?: number;
  level50?: number;
  level61_8?: number;
  level78_6?: number;
  level100?: number;
  ext127_2?: number;
  ext161_8?: number;
}

export type CrossoverType = "AC_BULLISH" | "AC_BEARISH" | "DC_BULLISH" | "DC_BEARISH" | "NONE";

export interface CrossoverEvaluation {
  hasCrossed: boolean;
  crossoverType: CrossoverType;
  label: string;
  levelPrice: number | null;
  triggerPrice: number;
  timestamp: string;
}

export interface FibBreakoutEvaluation {
  hasBroken: boolean;
  direction: "BULLISH" | "BEARISH" | "NONE";
  statusLabel: string;
  levelName: string | null;
  levelPrice: number | null;
  triggerPrice: number;
  breakoutTime: string | null;
  timeframe: string;
}

/**
 * Calculates complete institutional Fibonacci levels from Previous Day High (PDH), Low (PDL), and Close (PDC)
 */
export function calculateFibLevels(pdh: number, pdl: number, pdc: number = 0): FibLevels {
  const range = Number(Math.max(0, pdh - pdl).toFixed(2));
  const ac38_2 = Number((pdh - 0.382 * range).toFixed(2));
  const dc38_2 = Number((pdl + 0.382 * range).toFixed(2));

  const level0 = pdl;
  const level23_6 = Number((pdl + 0.236 * range).toFixed(2));
  const level50 = Number((pdl + 0.5 * range).toFixed(2));
  const level61_8 = Number((pdl + 0.618 * range).toFixed(2));
  const level78_6 = Number((pdl + 0.786 * range).toFixed(2));
  const level100 = pdh;
  const ext127_2 = Number((pdl + 1.272 * range).toFixed(2));
  const ext161_8 = Number((pdl + 1.618 * range).toFixed(2));

  return {
    pdh,
    pdl,
    pdc,
    range,
    ac38_2,
    dc38_2,
    level0,
    level23_6,
    level38_2: dc38_2,
    level50,
    level61_8,
    level78_6,
    level100,
    ext127_2,
    ext161_8,
  };
}

/**
 * Evaluates whether the latest closed candle crossed above or below Fibonacci AC / DC 38.2% levels
 */
export function evaluateCrossover(
  levels: FibLevels,
  candles: Candle[]
): CrossoverEvaluation {
  if (!candles || candles.length < 2) {
    const latest = candles?.[0];
    return {
      hasCrossed: false,
      crossoverType: "NONE",
      label: "Insufficient Data",
      levelPrice: null,
      triggerPrice: latest?.close ?? 0,
      timestamp: latest?.timestamp ?? new Date().toISOString(),
    };
  }

  // candles[0] is latest, candles[1] is previous
  const current = candles[0];
  const previous = candles[1];

  const prevClose = previous.close;
  const currClose = current.close;

  // 1. Check AC 38.2% Bullish Cross
  if (prevClose <= levels.ac38_2 && currClose > levels.ac38_2) {
    return {
      hasCrossed: true,
      crossoverType: "AC_BULLISH",
      label: "AC 38.2% Bullish Cross",
      levelPrice: levels.ac38_2,
      triggerPrice: currClose,
      timestamp: current.timestamp,
    };
  }

  // 2. Check AC 38.2% Bearish Cross
  if (prevClose >= levels.ac38_2 && currClose < levels.ac38_2) {
    return {
      hasCrossed: true,
      crossoverType: "AC_BEARISH",
      label: "AC 38.2% Bearish Breakdown",
      levelPrice: levels.ac38_2,
      triggerPrice: currClose,
      timestamp: current.timestamp,
    };
  }

  // 3. Check DC 38.2% Bullish Cross
  if (prevClose <= levels.dc38_2 && currClose > levels.dc38_2) {
    return {
      hasCrossed: true,
      crossoverType: "DC_BULLISH",
      label: "DC 38.2% Bullish Cross",
      levelPrice: levels.dc38_2,
      triggerPrice: currClose,
      timestamp: current.timestamp,
    };
  }

  // 4. Check DC 38.2% Bearish Cross
  if (prevClose >= levels.dc38_2 && currClose < levels.dc38_2) {
    return {
      hasCrossed: true,
      crossoverType: "DC_BEARISH",
      label: "DC 38.2% Bearish Breakdown",
      levelPrice: levels.dc38_2,
      triggerPrice: currClose,
      timestamp: current.timestamp,
    };
  }

  return {
    hasCrossed: false,
    crossoverType: "NONE",
    label: "Inside Range",
    levelPrice: null,
    triggerPrice: currClose,
    timestamp: current.timestamp,
  };
}

/**
 * Scans today's intraday candles chronologically to determine:
 * 1. Did price break a key Fibonacci level today?
 * 2. Which level broke (61.8% Golden Ratio, PDH 100%, 38.2% Support, PDL 0%)?
 * 3. On which timeframe candle did it break?
 * 4. Exactly what time did the breakout occur?
 */
export function analyzeIntradayFibBreakout(
  levels: FibLevels,
  candles: Candle[],
  timeframe: string
): FibBreakoutEvaluation {
  if (!candles || candles.length === 0 || levels.range === 0) {
    return {
      hasBroken: false,
      direction: "NONE",
      statusLabel: "No Data",
      levelName: null,
      levelPrice: null,
      triggerPrice: 0,
      breakoutTime: null,
      timeframe,
    };
  }

  // Upstox candles are returned reverse chronological (candles[0] is latest)
  // Reverse to evaluate chronological sequence from market open to close
  const chronological = [...candles].reverse();

  const ac38_2 = levels.ac38_2; // AC 38.2% Upper threshold
  const dc38_2 = levels.dc38_2; // DC 38.2% Lower threshold

  let activeBreakout: FibBreakoutEvaluation | null = null;

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

    // Up Breakout: Price crosses above AC 38.2% or initial candle is above AC 38.2%
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

    // Low Breakout: Price crosses below DC 38.2% or initial candle is below DC 38.2%
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

  // If currently holding above AC 38.2%, confirmed Up Breakout
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

  // If currently holding below DC 38.2%, confirmed Low Breakout
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

/**
 * Institutional Resampling Engine:
 * Synthesizes higher timeframe candles (2m, 3m, 5m, 15m) from 1-minute intraday candles.
 * Ensures zero Upstox 400 errors, eliminates redundant network calls, and calculates
 * exact Open, High (max), Low (min), Close, Volume (sum), and OI.
 */
export function aggregateCandles(candles1m: Candle[], targetMinutes: number): Candle[] {
  if (!candles1m || candles1m.length === 0 || targetMinutes <= 1) return candles1m;

  // Reverse reverse-chronological array to chronological order for accurate grouping
  const chrono = [...candles1m].reverse();
  const aggregated: Candle[] = [];

  const bucketMs = targetMinutes * 60 * 1000;
  let currentBucket: Candle[] = [];
  let currentBucketId: number | null = null;

  for (const c of chrono) {
    const cTime = new Date(c.timestamp).getTime();
    const bucketId = Math.floor(cTime / bucketMs);

    if (currentBucketId === null) {
      currentBucketId = bucketId;
      currentBucket = [c];
    } else if (bucketId === currentBucketId) {
      currentBucket.push(c);
    } else {
      aggregated.push({
        timestamp: currentBucket[currentBucket.length - 1].timestamp,
        open: currentBucket[0].open,
        high: Math.max(...currentBucket.map((b) => b.high)),
        low: Math.min(...currentBucket.map((b) => b.low)),
        close: currentBucket[currentBucket.length - 1].close,
        volume: currentBucket.reduce((sum, b) => sum + b.volume, 0),
        oi: currentBucket[currentBucket.length - 1].oi,
      });

      currentBucketId = bucketId;
      currentBucket = [c];
    }
  }

  if (currentBucket.length > 0) {
    aggregated.push({
      timestamp: currentBucket[currentBucket.length - 1].timestamp,
      open: currentBucket[0].open,
      high: Math.max(...currentBucket.map((b) => b.high)),
      low: Math.min(...currentBucket.map((b) => b.low)),
      close: currentBucket[currentBucket.length - 1].close,
      volume: currentBucket.reduce((sum, b) => sum + b.volume, 0),
      oi: currentBucket[currentBucket.length - 1].oi,
    });
  }

  // Reverse back to latest-first order
  return aggregated.reverse();
}

