const UPSTOX_BASE_URL = "https://api.upstox.com/v2";

export interface LiveMarketQuote {
  instrument_key: string;
  symbol: string;
  last_price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  net_change: number;
  oi: number;
}

/**
 * Batches up to 3,000 instruments in chunks of 500 symbols per request against Upstox Quotes API.
 * Executes sequentially with 100ms pacing delay to guarantee 0 rate limit errors.
 */
export async function fetchBatchQuotes(
  instrumentKeys: string[],
  token?: string
): Promise<Map<string, LiveMarketQuote>> {
  const authToken = token || process.env.UPSTOX_ACCESS_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  const results = new Map<string, LiveMarketQuote>();
  if (instrumentKeys.length === 0) return results;

  // Split into chunks of 500
  const CHUNK_SIZE = 500;
  const chunks: string[][] = [];
  for (let i = 0; i < instrumentKeys.length; i += CHUNK_SIZE) {
    chunks.push(instrumentKeys.slice(i, i + CHUNK_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const param = encodeURIComponent(chunk.map((k) => k.replace(":", "|")).join(","));
    const url = `${UPSTOX_BASE_URL}/market-quote/quotes?instrument_key=${param}`;

    try {
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        console.warn(`Batch quote chunk ${i + 1}/${chunks.length} status: ${res.status}`);
        continue;
      }

      const json = await res.json();
      const data = json.data || {};

      for (const [key, item] of Object.entries(data)) {
        const raw = item as Record<string, unknown>;
        const ohlc = (raw.ohlc || {}) as Record<string, number>;
        const normalizedKey = key.replace(":", "|");
        const symbol = (raw.symbol as string) || key.split(":")[1] || key;

        const quote: LiveMarketQuote = {
          instrument_key: normalizedKey,
          symbol,
          last_price: Number(raw.last_price || 0),
          open: Number(ohlc.open || 0),
          high: Number(ohlc.high || 0),
          low: Number(ohlc.low || 0),
          close: Number(ohlc.close || 0),
          volume: Number(raw.volume || 0),
          net_change: Number(raw.net_change || 0),
          oi: Number(raw.oi || 0),
        };

        results.set(normalizedKey, quote);
        results.set(symbol, quote);
        results.set(key, quote);

        // Upstox keys derivative responses by exchange trading symbol
        // (e.g. "NSE_FO:NIFTY26O0622200CE") instead of the requested token id
        // (e.g. "NSE_FO|40675"). Index by instrument_token so coordinator
        // lookups by instrument_key hit for OPTIONS (equities keep working
        // via the symbol index above).
        const token = raw.instrument_token as string | undefined;
        if (typeof token === "string" && token.length > 0) {
          results.set(token, quote);
          results.set(token.replace(":", "|"), quote);
        }
      }
    } catch (err) {
      console.error(`Error in batch quote chunk ${i + 1}:`, err);
    }

    // Pacing delay between chunks (100ms)
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}
