import { NextResponse } from "next/server";
import { INDICES_CONFIG, calculateAtmStrike } from "@/lib/options-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "Missing UPSTOX_ACCESS_TOKEN" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const instrumentKey = searchParams.get("instrument_key") || "NSE_INDEX|Nifty 50";
    let requestedExpiry = searchParams.get("expiry_date");

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 1. Fetch Spot Quotes for all 4 benchmark indices
    const indicesQuotes: Record<string, { ltp: number; change: number; pChange: number }> = {};
    for (const idx of INDICES_CONFIG) {
      try {
        const quoteRes = await fetch(
          `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(idx.key)}`,
          { headers, next: { revalidate: 10 } }
        );
        if (quoteRes.ok) {
          const qData = await quoteRes.json();
          const firstKey = Object.keys(qData.data || {})[0];
          const quoteObj = qData.data?.[firstKey];
          if (quoteObj) {
            const ltp = quoteObj.last_price || 0;
            // Upstox provides net_change directly against previous day close!
            const change = typeof quoteObj.net_change === "number" ? quoteObj.net_change : 0;
            const prevDayClose = ltp - change;
            const pChange = prevDayClose > 0 ? (change / prevDayClose) * 100 : 0;
            indicesQuotes[idx.name] = {
              ltp,
              change: Number(change.toFixed(2)),
              pChange: Number(pChange.toFixed(2)),
            };
          }
        }
      } catch (e) {
        console.error(`Error fetching quote for ${idx.name}:`, e);
      }
    }

    // 2. Fetch Option Contracts & available Expiries for the selected index
    const contractsRes = await fetch(
      `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey)}`,
      { headers, next: { revalidate: 60 } }
    );
    if (!contractsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch option contracts" }, { status: 502 });
    }
    const contractsData = await contractsRes.json();
    const allContracts = contractsData.data || [];
    const expiries = Array.from(new Set(allContracts.map((c: { expiry: string }) => c.expiry))).sort() as string[];

    if (!requestedExpiry || !expiries.includes(requestedExpiry)) {
      requestedExpiry = expiries[0] || "";
    }

    interface OptionContractData {
      instrument_key?: string;
      market_data?: {
        oi?: number;
        prev_oi?: number;
        volume?: number;
        ltp?: number;
        close_price?: number;
      };
    }

    let chainRows: Array<{
      strike_price: number;
      call_options?: OptionContractData;
      put_options?: OptionContractData;
    }> = [];

    let totalCallOI = 0;
    let totalPutOI = 0;

    if (requestedExpiry) {
      const chainUrl = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(
        instrumentKey
      )}&expiry_date=${requestedExpiry}`;
      const chainRes = await fetch(chainUrl, { headers, next: { revalidate: 5 } });
      if (chainRes.ok) {
        const cData = await chainRes.json();
        chainRows = cData.data || [];
        for (const row of chainRows) {
          const cOI = row.call_options?.market_data?.oi || 0;
          const pOI = row.put_options?.market_data?.oi || 0;
          totalCallOI += cOI;
          totalPutOI += pOI;
        }
      }
    }

    const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 0;

    // Identify current spot price and ATM strike
    const selectedConfig = INDICES_CONFIG.find((c) => c.key === instrumentKey) || INDICES_CONFIG[0];
    const spotPrice = indicesQuotes[selectedConfig.name]?.ltp || 0;
    const atmStrike = spotPrice > 0 ? calculateAtmStrike(spotPrice, selectedConfig.step) : 0;

    // Format strike chain table items
    let maxCallVolume = 0;
    let maxPutVolume = 0;

    const formattedChain = chainRows.map((r) => {
      const sp = r.strike_price;
      const cMarket = r.call_options?.market_data;
      const pMarket = r.put_options?.market_data;

      const callOI = cMarket?.oi || 0;
      const callPrevOI = cMarket?.prev_oi || 0;
      const callOIChange = callOI - callPrevOI;
      const callVol = cMarket?.volume || 0;

      const putOI = pMarket?.oi || 0;
      const putPrevOI = pMarket?.prev_oi || 0;
      const putOIChange = putOI - putPrevOI;
      const putVol = pMarket?.volume || 0;

      if (callVol > maxCallVolume) maxCallVolume = callVol;
      if (putVol > maxPutVolume) maxPutVolume = putVol;

      // Net OI = Put OI - Call OI
      const netOI = putOI - callOI;
      // Net OI Change = Put OI Change - Call OI Change (or total net shift)
      const netOIChange = putOIChange - callOIChange;

      return {
        sp,
        callInstrumentKey: r.call_options?.instrument_key,
        putInstrumentKey: r.put_options?.instrument_key,
        callOI,
        callPrevOI,
        callOIChange,
        callVol,
        putOI,
        putPrevOI,
        putOIChange,
        putVol,
        netOI,
        netOIChange,
      };
    });

    return NextResponse.json({
      success: true,
      instrumentKey,
      spotPrice,
      atmStrike,
      step: selectedConfig.step,
      indices: indicesQuotes,
      expiries,
      selectedExpiry: requestedExpiry,
      pcr,
      totalCallOI,
      totalPutOI,
      maxCallVolume,
      maxPutVolume,
      chain: formattedChain,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("API /api/options/chain error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
