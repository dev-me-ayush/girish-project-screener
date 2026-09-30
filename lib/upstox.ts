import { Candle, FibLevels, calculateFibLevels } from "./fibonacci";

const UPSTOX_BASE_URL = "https://api.upstox.com/v2";

export interface IndexQuote {
  name: string;
  symbol: string;
  instrumentKey: string;
  lastPrice: number;
  netChange: number;
  percentageChange: number;
  open: number;
  high: number;
  low: number;
  close: number;
  fibLevels?: FibLevels;
  referenceDate?: string;
}

export interface OptionContract {
  name: string;
  instrumentKey: string;
  tradingSymbol: string;
  strikePrice: number;
  optionType: "CE" | "PE";
  expiry: string;
  lotSize: number;
  underlyingKey: string;
  isAtm?: boolean;
  distanceFromAtm?: number; // 0 for ATM, -1 to -7 for below, +1 to +7 for above
}

export interface EquitySymbol {
  symbol: string;
  name: string;
  instrumentKey: string;
  sector?: string;
}

// Curated universe of high-liquidity NSE Equities
export const TOP_NSE_EQUITIES: EquitySymbol[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", instrumentKey: "NSE_EQ|INE002A01018", sector: "Energy" },
  { symbol: "TCS", name: "Tata Consultancy Services", instrumentKey: "NSE_EQ|INE467B01029", sector: "IT" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", instrumentKey: "NSE_EQ|INE040A01034", sector: "Banking" },
  { symbol: "INFY", name: "Infosys Ltd", instrumentKey: "NSE_EQ|INE009A01021", sector: "IT" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", instrumentKey: "NSE_EQ|INE090A01021", sector: "Banking" },
  { symbol: "SBIN", name: "State Bank of India", instrumentKey: "NSE_EQ|INE062A01020", sector: "Banking" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", instrumentKey: "NSE_EQ|INE397D01024", sector: "Telecom" },
  { symbol: "ITC", name: "ITC Ltd", instrumentKey: "NSE_EQ|INE154A01025", sector: "FMCG" },
  { symbol: "LT", name: "Larsen & Toubro Ltd", instrumentKey: "NSE_EQ|INE018A01030", sector: "Infrastructure" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", instrumentKey: "NSE_EQ|INE155A01022", sector: "Automobile" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", instrumentKey: "NSE_EQ|INE238A01034", sector: "Banking" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", instrumentKey: "NSE_EQ|INE237A01028", sector: "Banking" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", instrumentKey: "NSE_EQ|INE030A01027", sector: "FMCG" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Ind", instrumentKey: "NSE_EQ|INE044A01036", sector: "Pharma" },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", instrumentKey: "NSE_EQ|INE585B01010", sector: "Automobile" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", instrumentKey: "NSE_EQ|INE081A01020", sector: "Metals" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", instrumentKey: "NSE_EQ|INE296A01024", sector: "Finance" },
  { symbol: "TITAN", name: "Titan Company Ltd", instrumentKey: "NSE_EQ|INE280A01028", sector: "Consumer" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd", instrumentKey: "NSE_EQ|INE148A01019", sector: "Paints" },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd", instrumentKey: "NSE_EQ|INE860A01027", sector: "IT" },
];

export const SUPPORTED_INDICES = [
  { name: "NIFTY 50", symbol: "NIFTY", instrumentKey: "NSE_INDEX|Nifty 50", stepSize: 50 },
  { name: "BANK NIFTY", symbol: "BANKNIFTY", instrumentKey: "NSE_INDEX|Nifty Bank", stepSize: 100 },
  { name: "SENSEX", symbol: "SENSEX", instrumentKey: "BSE_INDEX|SENSEX", stepSize: 100 },
];

function getHeaders() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch Header Indices Quotes (Nifty 50, Bank Nifty, Sensex)
 */
export async function getHeaderIndicesQuotes(): Promise<IndexQuote[]> {
  try {
    const keys = SUPPORTED_INDICES.map((i) => i.instrumentKey).join(",");
    const url = `${UPSTOX_BASE_URL}/market-quote/ohlc?instrument_key=${encodeURIComponent(keys)}&interval=1d`;
    const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch indices: ${res.status}`);
    }
    const json = await res.json();
    const data = json.data || {};

    return SUPPORTED_INDICES.map((idx) => {
      const formattedKey = idx.instrumentKey.replace("|", ":");
      const quote = data[formattedKey] || {};
      const ohlc = quote.ohlc || {};
      const lastPrice = quote.last_price || ohlc.close || 0;
      const prevClose = ohlc.close || lastPrice;
      const netChange = Number((lastPrice - (ohlc.open || lastPrice)).toFixed(2));
      const percentageChange = prevClose ? Number(((netChange / prevClose) * 100).toFixed(2)) : 0;
      const high = ohlc.high || lastPrice;
      const low = ohlc.low || lastPrice;
      const close = ohlc.close || lastPrice;
      const fibLevels = high > 0 && low > 0 ? calculateFibLevels(high, low, close) : undefined;

      const refDate = new Date();
      refDate.setDate(refDate.getDate() - 1);
      if (refDate.getDay() === 0) refDate.setDate(refDate.getDate() - 2);
      else if (refDate.getDay() === 6) refDate.setDate(refDate.getDate() - 1);
      const referenceDate = refDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return {
        name: idx.name,
        symbol: idx.symbol,
        instrumentKey: idx.instrumentKey,
        lastPrice,
        netChange,
        percentageChange,
        open: ohlc.open || 0,
        high: ohlc.high || 0,
        low: ohlc.low || 0,
        close: ohlc.close || 0,
        fibLevels,
        referenceDate,
      };
    });
  } catch (err) {
    console.error("Error fetching header indices quotes:", err);
    return SUPPORTED_INDICES.map((idx) => ({
      name: idx.name,
      symbol: idx.symbol,
      instrumentKey: idx.instrumentKey,
      lastPrice: 0,
      netChange: 0,
      percentageChange: 0,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
    }));
  }
}

const memoryDailyRangeCache = new Map<string, { levels: FibLevels; date: string }>();
const memoryIntradayCandleCache = new Map<string, { candles: Candle[]; timestamp: number }>();
const INTRADAY_CACHE_TTL_MS = 15_000;

/**
 * Robust fetch with automatic retry on Upstox 429 Rate Limiting
 */
async function fetchUpstoxWithRetry(url: string, maxRetries = 2): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
      if (res.status === 429) {
        lastResponse = res;
        if (attempt < maxRetries) {
          const delayMs = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
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
  return lastResponse || fetch(url, { headers: getHeaders(), cache: "no-store" });
}

/**
 * Fetch Previous Day High (PDH), Low (PDL), Close (PDC)
 */
export async function getPreviousDayRange(instrumentKey: string): Promise<FibLevels> {
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
    const url = `${UPSTOX_BASE_URL}/historical-candle/${encodeURIComponent(instrumentKey)}/day/${today}/${fromDate}`;
    const res = await fetchUpstoxWithRetry(url);
    if (!res.ok) {
      throw new Error(`Historical daily request failed: ${res.status}`);
    }
    const json = await res.json();
    const candles = json.data?.candles || [];

    // Filter out today's in-progress candle if Upstox includes it, ensuring we strictly use the completed previous session
    const completedCandles = candles.filter((c: [string, number, number, number, number, number, number]) => !c[0].startsWith(todayIST));
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
    console.error(`Error fetching daily range for ${instrumentKey}:`, err);
  }

  // Fallback to previous cached levels if available rather than returning zeroes
  if (cached && cached.levels.range > 0) {
    return cached.levels;
  }

  return calculateFibLevels(0, 0, 0);
}

/**
 * Fetch Intraday Candles (1m, 3m, 5m)
 */
export async function getIntradayCandles(
  instrumentKey: string,
  timeframe: "1m" | "2m" | "3m" | "5m" | "15m" = "1m"
): Promise<Candle[]> {
  const normKey = instrumentKey.replace(":", "|");
  const intervalParam =
    timeframe === "2m"
      ? "2minute"
      : timeframe === "3m"
      ? "3minute"
      : timeframe === "5m"
      ? "5minute"
      : timeframe === "15m"
      ? "15minute"
      : "1minute";

  const cacheKey = `${normKey}_${intervalParam}`;
  const now = Date.now();
  const cached = memoryIntradayCandleCache.get(cacheKey);
  if (cached && now - cached.timestamp < INTRADAY_CACHE_TTL_MS && cached.candles.length > 0) {
    return cached.candles;
  }

  try {
    const url = `${UPSTOX_BASE_URL}/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/${intervalParam}`;
    const res = await fetchUpstoxWithRetry(url);
    if (!res.ok) {
      throw new Error(`Intraday candle request failed: ${res.status}`);
    }
    const json = await res.json();
    const rawCandles = json.data?.candles || [];

    const candles = rawCandles.map((c: [string, number, number, number, number, number, number]) => ({
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
    console.error(`Error fetching intraday candles for ${instrumentKey}:`, err);
    if (cached && cached.candles.length > 0) {
      return cached.candles;
    }
    return [];
  }
}

/**
 * Fetch Live Quotes and Open Interest (OI) in bulk
 */
export interface QuoteEntry {
  lastPrice: number;
  oi: number;
  volume: number;
  netChange: number;
  ohlc?: { open: number; high: number; low: number; close: number };
}

const memoryQuoteCache = new Map<string, { quote: QuoteEntry; timestamp: number }>();
const QUOTE_CACHE_TTL_MS = 10_000;

export async function getQuotesAndOI(
  instrumentKeys: string[]
): Promise<Record<string, QuoteEntry>> {
  if (instrumentKeys.length === 0) return {};

  const now = Date.now();
  const result: Record<string, QuoteEntry> = {};
  const keysToFetch: string[] = [];

  for (const rawKey of instrumentKeys) {
    const key = rawKey.trim();
    const standardKey = key.replace(":", "|");
    const cached = memoryQuoteCache.get(standardKey) || memoryQuoteCache.get(key);
    if (cached && now - cached.timestamp < QUOTE_CACHE_TTL_MS) {
      result[standardKey] = cached.quote;
      result[key] = cached.quote;
    } else {
      keysToFetch.push(key);
    }
  }

  if (keysToFetch.length === 0) {
    return result;
  }

  // Batch in chunks of 50 with 3-second timeout
  const chunkSize = 50;
  for (let i = 0; i < keysToFetch.length; i += chunkSize) {
    const chunk = keysToFetch.slice(i, i + chunkSize);
    try {
      const url = `${UPSTOX_BASE_URL}/market-quote/quotes?instrument_key=${encodeURIComponent(chunk.join(","))}`;
      const res = await fetch(url, {
        headers: getHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const data = json.data || {};

      for (const [key, quote] of Object.entries(data)) {
        const item = quote as {
          last_price?: number;
          oi?: number;
          volume?: number;
          net_change?: number;
          ohlc?: { open: number; high: number; low: number; close: number };
          instrument_token?: string;
        };
        const standardKey = key.replace(":", "|");
        const parsedOi = Number(item.oi ?? (item as unknown as { open_interest?: number }).open_interest ?? 0);
        const lastPrice = item.last_price || item.ohlc?.close || 0;
        const netChange =
          typeof item.net_change === "number"
            ? item.net_change
            : (lastPrice > 0 && item.ohlc?.open ? Number((lastPrice - item.ohlc.open).toFixed(2)) : 0);

        const entry: QuoteEntry = {
          lastPrice,
          oi: isNaN(parsedOi) ? 0 : parsedOi,
          volume: item.volume || 0,
          netChange,
          ohlc: item.ohlc,
        };

        result[standardKey] = entry;
        result[key] = entry;

        if (item.instrument_token) {
          const tok = item.instrument_token;
          const tokStd = tok.replace(":", "|");
          result[tok] = entry;
          result[tokStd] = entry;
          memoryQuoteCache.set(tok, { quote: entry, timestamp: now });
          memoryQuoteCache.set(tokStd, { quote: entry, timestamp: now });
        }

        const sym = (item as unknown as { symbol?: string }).symbol;
        if (sym) {
          result[sym] = entry;
          result[`NSE_EQ:${sym}`] = entry;
          result[`NSE_EQ|${sym}`] = entry;
          memoryQuoteCache.set(sym, { quote: entry, timestamp: now });
          memoryQuoteCache.set(`NSE_EQ:${sym}`, { quote: entry, timestamp: now });
          memoryQuoteCache.set(`NSE_EQ|${sym}`, { quote: entry, timestamp: now });
        }

        memoryQuoteCache.set(standardKey, { quote: entry, timestamp: now });
        memoryQuoteCache.set(key, { quote: entry, timestamp: now });
      }
    } catch (err) {
      console.error("Error fetching bulk quotes and OI:", err);
    }
  }

  // Enrich Equities and Indices with their active F&O derivative Open Interest
  const underlyingKeysToResolve = Array.from(
    new Set(
      instrumentKeys
        .map((k) => k.trim())
        .filter((k) => {
          const std = k.replace(":", "|");
          const entry = result[std] || result[k];
          return (
            entry &&
            entry.oi === 0 &&
            (std.startsWith("NSE_EQ") || std.startsWith("NSE_INDEX") || std.startsWith("BSE_INDEX"))
          );
        })
    )
  );

  if (underlyingKeysToResolve.length > 0) {
    await Promise.all(
      underlyingKeysToResolve.map(async (rawKey) => {
        const std = rawKey.replace(":", "|");
        const fnoOi = await getUnderlyingFnoOI(std);
        if (fnoOi > 0) {
          const entry = result[std] || result[rawKey];
          if (entry) {
            entry.oi = fnoOi;
            result[std] = entry;
            result[rawKey] = entry;
            memoryQuoteCache.set(std, { quote: entry, timestamp: now });
            memoryQuoteCache.set(rawKey, { quote: entry, timestamp: now });
          }
        }
      })
    );
  }

  return result;
}

const fnoOiCache = new Map<string, { oi: number; timestamp: number }>();
const FNO_OI_CACHE_TTL_MS = 60_000;

/**
 * Resolves Open Interest for Equities and Indices from their underlying F&O option chain.
 * In Indian exchanges (NSE/BSE), cash equity quotes (NSE_EQ) do not possess Open Interest (OI = 0).
 * For F&O underlying equities (e.g. RELIANCE, TCS, INFY), active Open Interest is derived by aggregating
 * current-expiry derivative contracts from Upstox's option chain API.
 */
export async function getUnderlyingFnoOI(instrumentKey: string): Promise<number> {
  const normalizedKey = instrumentKey.replace(":", "|");
  const now = Date.now();
  const cached = fnoOiCache.get(normalizedKey);
  if (cached && now - cached.timestamp < FNO_OI_CACHE_TTL_MS) {
    return cached.oi;
  }

  try {
    const contractUrl = `${UPSTOX_BASE_URL}/option/contract?instrument_key=${encodeURIComponent(normalizedKey)}`;
    const contractRes = await fetch(contractUrl, {
      headers: getHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!contractRes.ok) {
      fnoOiCache.set(normalizedKey, { oi: 0, timestamp: now });
      return 0;
    }
    const contractJson = await contractRes.json();
    const rawContracts = (contractJson.data || []) as Array<{ expiry: string }>;
    if (rawContracts.length === 0) {
      fnoOiCache.set(normalizedKey, { oi: 0, timestamp: now });
      return 0;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const validExpiries = [
      ...new Set(rawContracts.map((c) => c.expiry).filter((exp) => exp >= todayStr)),
    ].sort();
    const nearestExpiry = validExpiries[0];
    if (!nearestExpiry) {
      fnoOiCache.set(normalizedKey, { oi: 0, timestamp: now });
      return 0;
    }

    const chainUrl = `${UPSTOX_BASE_URL}/option/chain?instrument_key=${encodeURIComponent(normalizedKey)}&expiry_date=${encodeURIComponent(nearestExpiry)}`;
    const chainRes = await fetch(chainUrl, {
      headers: getHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!chainRes.ok) {
      fnoOiCache.set(normalizedKey, { oi: 0, timestamp: now });
      return 0;
    }

    const chainJson = await chainRes.json();
    let totalOi = 0;
    for (const item of (chainJson.data || [])) {
      totalOi += (item.call_options?.market_data?.oi || 0) + (item.put_options?.market_data?.oi || 0);
    }

    fnoOiCache.set(normalizedKey, { oi: totalOi, timestamp: now });
    return totalOi;
  } catch (err) {
    console.error(`Error resolving F&O OI for ${normalizedKey}:`, err);
    return 0;
  }
}

/**
 * Strict Index Option Discovery:
 * - Current Expiry Only
 * - Strictly ATM +- 7 Strikes (7 Calls + 7 Puts + 1 ATM = 15 strikes total)
 * - Excludes any strike outside this range
 */
export async function getIndexOptionChain(
  underlyingKey: string,
  strikeRadius: number = 7
): Promise<{
  underlying: {
    name: string;
    spotPrice: number;
    nearestExpiry: string;
    atmStrike: number;
  };
  options: OptionContract[];
}> {
  // 1. Fetch Spot Price of Underlying
  const spotUrl = `${UPSTOX_BASE_URL}/market-quote/ohlc?instrument_key=${encodeURIComponent(underlyingKey)}&interval=1d`;
  const spotRes = await fetch(spotUrl, { headers: getHeaders(), cache: "no-store" });
  if (!spotRes.ok) throw new Error(`Failed to fetch spot price: ${spotRes.status}`);
  const spotJson = await spotRes.json();
  const formattedKey = underlyingKey.replace("|", ":");
  const spotQuote = spotJson.data?.[formattedKey];
  const spotPrice = spotQuote?.last_price || spotQuote?.ohlc?.close || 0;

  // 2. Fetch Option Contracts
  const contractUrl = `${UPSTOX_BASE_URL}/option/contract?instrument_key=${encodeURIComponent(underlyingKey)}`;
  const contractRes = await fetch(contractUrl, { headers: getHeaders(), cache: "no-store" });
  if (!contractRes.ok) throw new Error(`Failed to fetch option contracts: ${contractRes.status}`);
  const contractJson = await contractRes.json();
  const rawContracts = (contractJson.data || []) as Array<{
    name: string;
    segment: string;
    expiry: string;
    instrument_key: string;
    trading_symbol: string;
    strike_price: number;
    instrument_type: "CE" | "PE";
    lot_size: number;
    underlying_key: string;
  }>;

  if (rawContracts.length === 0) {
    throw new Error(`No option contracts available for ${underlyingKey}`);
  }

  // 3. Find Nearest Active Expiry (today or in future)
  const todayStr = new Date().toISOString().split("T")[0];
  const validExpiries = [
    ...new Set(rawContracts.map((c) => c.expiry).filter((exp) => exp >= todayStr)),
  ].sort();

  const nearestExpiry = validExpiries[0] || rawContracts[0].expiry;

  // Filter only for current expiry
  const currentExpiryContracts = rawContracts.filter((c) => c.expiry === nearestExpiry);

  // 4. Find all unique strike prices for this expiry and sort numerically
  const uniqueStrikes = [...new Set(currentExpiryContracts.map((c) => Number(c.strike_price)))].sort(
    (a, b) => a - b
  );

  // 5. Find ATM Strike (the strike closest to spotPrice)
  let closestStrike = uniqueStrikes[0];
  let minDiff = Math.abs(spotPrice - closestStrike);
  let closestIdx = 0;

  for (let i = 0; i < uniqueStrikes.length; i++) {
    const diff = Math.abs(spotPrice - uniqueStrikes[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closestStrike = uniqueStrikes[i];
      closestIdx = i;
    }
  }

  // 6. Strictly slice ATM -strikeRadius to ATM +strikeRadius
  const startIdx = Math.max(0, closestIdx - strikeRadius);
  const endIdx = Math.min(uniqueStrikes.length, closestIdx + strikeRadius + 1);
  const allowedStrikes = uniqueStrikes.slice(startIdx, endIdx);

  // 7. Format the resulting options
  const finalOptions: OptionContract[] = [];

  for (const strike of allowedStrikes) {
    const distance = allowedStrikes.indexOf(strike) - (closestIdx - startIdx);
    const isAtm = strike === closestStrike;

    const callContract = currentExpiryContracts.find(
      (c) => Number(c.strike_price) === strike && c.instrument_type === "CE"
    );
    const putContract = currentExpiryContracts.find(
      (c) => Number(c.strike_price) === strike && c.instrument_type === "PE"
    );

    if (callContract) {
      finalOptions.push({
        name: callContract.name,
        instrumentKey: callContract.instrument_key,
        tradingSymbol: callContract.trading_symbol,
        strikePrice: strike,
        optionType: "CE",
        expiry: nearestExpiry,
        lotSize: callContract.lot_size,
        underlyingKey,
        isAtm,
        distanceFromAtm: distance,
      });
    }

    if (putContract) {
      finalOptions.push({
        name: putContract.name,
        instrumentKey: putContract.instrument_key,
        tradingSymbol: putContract.trading_symbol,
        strikePrice: strike,
        optionType: "PE",
        expiry: nearestExpiry,
        lotSize: putContract.lot_size,
        underlyingKey,
        isAtm,
        distanceFromAtm: distance,
      });
    }
  }

  const underlyingName = SUPPORTED_INDICES.find((i) => i.instrumentKey === underlyingKey)?.name || underlyingKey;

  return {
    underlying: {
      name: underlyingName,
      spotPrice,
      nearestExpiry,
      atmStrike: closestStrike,
    },
    options: finalOptions,
  };
}
