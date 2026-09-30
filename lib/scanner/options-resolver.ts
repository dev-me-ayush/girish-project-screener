import { getIndexOptionChain } from "../upstox";

export interface ResolvedOptionContract {
  symbol: string;
  instrument_key: string;
  underlying: string;
  strike_price: number;
  option_type: "CE" | "PE";
  expiry: string;
}

// In-memory cache for resolved options contracts (refreshed once per day or on expiry change)
let cachedOptions: { contracts: ResolvedOptionContract[]; date: string } | null = null;

/**
 * Resolves the 52 most liquid index option contracts for the active weekly expiry:
 * - NIFTY 50: ATM ± 7 strikes (15 strikes: 15 CE + 15 PE = 30 contracts)
 * - BANK NIFTY: ATM ± 5 strikes (11 strikes: 11 CE + 11 PE = 22 contracts)
 */
export async function getActiveAtmOptionsContracts(
  forceRefresh: boolean = false
): Promise<ResolvedOptionContract[]> {
  const istToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  if (!forceRefresh && cachedOptions && cachedOptions.date === istToday && cachedOptions.contracts.length > 0) {
    return cachedOptions.contracts;
  }

  try {
    const [niftyChain, bankChain] = await Promise.all([
      getIndexOptionChain("NSE_INDEX|Nifty 50", 7),
      getIndexOptionChain("NSE_INDEX|Nifty Bank", 5),
    ]);

    const result: ResolvedOptionContract[] = [];

    for (const opt of niftyChain.options) {
      result.push({
        symbol: opt.tradingSymbol,
        instrument_key: opt.instrumentKey,
        underlying: "NIFTY",
        strike_price: opt.strikePrice,
        option_type: opt.optionType,
        expiry: opt.expiry,
      });
    }

    for (const opt of bankChain.options) {
      result.push({
        symbol: opt.tradingSymbol,
        instrument_key: opt.instrumentKey,
        underlying: "BANKNIFTY",
        strike_price: opt.strikePrice,
        option_type: opt.optionType,
        expiry: opt.expiry,
      });
    }

    cachedOptions = { contracts: result, date: istToday };
    return result;
  } catch (err) {
    console.error("Failed to resolve active ATM options chain:", err);
    return cachedOptions?.contracts || [];
  }
}
