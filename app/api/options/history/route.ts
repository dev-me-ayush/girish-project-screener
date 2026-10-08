import { NextResponse } from "next/server";

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

    // Fetch 1-min intraday candles for all CE & PE instruments in parallel
    const candlesByKey: Record<string, Array<[string, number, number, number, number, number, number]>> = {};

    await Promise.all(
      strikes.flatMap((s) => [s.ceKey, s.peKey]).filter(Boolean).map(async (key) => {
        try {
          const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(key)}/1minute`;
          const res = await fetch(url, { headers, next: { revalidate: 10 } });
          if (res.ok) {
            const data = await res.json();
            candlesByKey[key] = data.data?.candles || [];
          } else {
            candlesByKey[key] = [];
          }
        } catch (e) {
          console.error(`Error fetching candle for ${key}:`, e);
          candlesByKey[key] = [];
        }
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

    // Get the base/opening OI for each contract (earliest candle of today or prev_oi)
    const baseOIByKey: Record<string, number> = {};
    for (const key of Object.keys(candlesByKey)) {
      const arr = candlesByKey[key];
      if (arr.length > 0) {
        // Earliest candle of the day
        const earliest = arr[arr.length - 1];
        baseOIByKey[key] = earliest[6] || 0;
      } else {
        baseOIByKey[key] = 0;
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
        changeDiff: 0, // will compute relative to next row (older time)
        revSignal: false,
      });
    }

    // Compute changeDiff (Delta = Diff_T - Diff_{T-1})
    // Since rows are ordered newest to oldest: Diff_{T-1} is at index + 1
    for (let i = 0; i < rows.length; i++) {
      if (i + 1 < rows.length) {
        const prevDiff = rows[i + 1].difference;
        rows[i].changeDiff = rows[i].difference - prevDiff;
        // Reversal signal when changeDiff flips from negative to positive
        const nextOlderDelta = i + 2 < rows.length ? rows[i + 1].difference - rows[i + 2].difference : 0;
        if (rows[i].changeDiff > 0 && nextOlderDelta <= 0) {
          rows[i].revSignal = true;
        }
      } else {
        rows[i].changeDiff = 0;
        rows[i].revSignal = false;
      }
    }

    return NextResponse.json({
      success: true,
      intervalMinutes: step,
      totalSnapshots: rows.length,
      rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("API /api/options/history error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
