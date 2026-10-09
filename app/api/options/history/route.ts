import { NextResponse } from "next/server";
import { annotateOISignals } from "@/lib/options-signals";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "Missing UPSTOX_ACCESS_TOKEN" }, { status: 500 });
    }

    const body = await request.json();
    const {
      strikes = [], // Array of 3 strikes: [{ strike: 23900, ceKey: '...', peKey: '...' }, ...]
      intervalMinutes = 3, // 1, 3, 5, 15
    } = body;

    if (!Array.isArray(strikes) || strikes.length === 0) {
      return NextResponse.json({ error: "Strikes array required" }, { status: 400 });
    }

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Fetch 1-min intraday candles for all CE & PE instruments in parallel with retry
    const candlesByKey: Record<string, Array<[string, number, number, number, number, number, number]>> = {};

    interface StrikeItem {
      strike: number;
      ceKey: string;
      peKey: string;
      cePrevOI?: number;
      pePrevOI?: number;
    }

    const strikeList: StrikeItem[] = strikes;

    const allKeys = Array.from(new Set(strikeList.flatMap((s) => [s.ceKey, s.peKey]).filter(Boolean)));

    // Calculate current Indian standard date (YYYY-MM-DD)
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayISTString = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, "0")}-${String(
      nowIST.getDate()
    ).padStart(2, "0")}`;

    await Promise.all(
      allKeys.map(async (key) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(key)}/1minute`;
            const res = await fetch(url, { headers, cache: "no-store" });
            if (res.ok) {
              const data = await res.json();
              const rawCandles = data.data?.candles || [];
              // Strictly isolate candles belonging to today's trading session
              candlesByKey[key] = rawCandles.filter((c: [string, ...unknown[]]) =>
                typeof c[0] === "string" && c[0].startsWith(todayISTString)
              );
              return;
            }
          } catch (e) {
            console.error(`Error fetching candle for ${key} (attempt ${attempt + 1}):`, e);
          }
          // small pause before retry if failed
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        candlesByKey[key] = [];
      })
    );

    // Collect all unique minute timestamps in descending order (newest first)
    const timestampSet = new Set<string>();
    for (const key of Object.keys(candlesByKey)) {
      for (const candle of candlesByKey[key]) {
        timestampSet.add(candle[0]);
      }
    }

    const sortedTimestamps = Array.from(timestampSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Filter timestamps according to intervalMinutes
    // e.g. for 3-minute buckets, pick timestamps where minute % 3 === 0 or step by interval
    const step = Math.max(1, intervalMinutes);
    const sampledTimestamps: string[] = [];
    for (let i = 0; i < sortedTimestamps.length; i += step) {
      sampledTimestamps.push(sortedTimestamps[i]);
    }

    // Build lookup map for fast retrieval: key -> (timestamp -> candle)
    const candleMap: Record<string, Record<string, [string, number, number, number, number, number, number]>> = {};
    for (const key of Object.keys(candlesByKey)) {
      candleMap[key] = {};
      for (const candle of candlesByKey[key]) {
        candleMap[key][candle[0]] = candle;
      }
    }

    // Base OI mapping: Use exact Upstox previous day's close (prev_oi) passed from option chain.
    // Fall back to earliest 09:15 candle if prev_oi is not provided.
    const baseOIByKey: Record<string, number> = {};
    for (const s of strikeList) {
      if (s.ceKey) {
        if (typeof s.cePrevOI === "number") {
          baseOIByKey[s.ceKey] = s.cePrevOI;
        } else {
          const arr = candlesByKey[s.ceKey] || [];
          baseOIByKey[s.ceKey] = arr.length > 0 ? (arr[arr.length - 1][6] || 0) : 0;
        }
      }
      if (s.peKey) {
        if (typeof s.pePrevOI === "number") {
          baseOIByKey[s.peKey] = s.pePrevOI;
        } else {
          const arr = candlesByKey[s.peKey] || [];
          baseOIByKey[s.peKey] = arr.length > 0 ? (arr[arr.length - 1][6] || 0) : 0;
        }
      }
    }

    // Compute rows for the bottom table (from newest to oldest)
    const rows = [];
    for (let idx = 0; idx < sampledTimestamps.length; idx++) {
      const ts = sampledTimestamps[idx];
      const d = new Date(ts);
      // Format time as HH:MM in IST
      const timeStr = d.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const strikeData: Array<{ strike: number; callOIChange: number; putOIChange: number }> = [];
      let totalCallOIChange = 0;
      let totalPutOIChange = 0;

      for (const s of strikes) {
        const ceCandle = candleMap[s.ceKey]?.[ts];
        const peCandle = candleMap[s.peKey]?.[ts];

        const ceCurrentOI = ceCandle ? ceCandle[6] : baseOIByKey[s.ceKey] || 0;
        const peCurrentOI = peCandle ? peCandle[6] : baseOIByKey[s.peKey] || 0;

        const ceBaseOI = baseOIByKey[s.ceKey] || 0;
        const peBaseOI = baseOIByKey[s.peKey] || 0;

        const ceChange = ceCurrentOI - ceBaseOI;
        const peChange = peCurrentOI - peBaseOI;

        strikeData.push({
          strike: s.strike,
          callOIChange: ceChange,
          putOIChange: peChange,
        });

        totalCallOIChange += ceChange;
        totalPutOIChange += peChange;
      }

      const difference = totalPutOIChange - totalCallOIChange;

      rows.push({
        timestamp: ts,
        time: timeStr,
        strikes: strikeData,
        totalCallOIChange,
        totalPutOIChange,
        difference,
        changeDiff: 0, // computed below relative to next row (older time)
        signal: null,
        revSignal: false,
      });
    }

    // Compute changeDiff (Delta = Diff_T - Diff_{T-1}) and directional
    // BULLISH / BEARISH inflection signals (newest to oldest).
    annotateOISignals(rows);

    return NextResponse.json(
      {
        success: true,
        intervalMinutes: step,
        totalSnapshots: rows.length,
        rows,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("API /api/options/history error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
