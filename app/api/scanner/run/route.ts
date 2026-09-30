import { NextRequest, NextResponse } from "next/server";
import { runWatchlistScan } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { watchlistId, timeframe = "1m" } = body;

    if (!watchlistId) {
      return NextResponse.json(
        { status: "error", message: "watchlistId is required" },
        { status: 400 }
      );
    }

    const validTimeframes = ["1m", "3m", "5m"];
    const tf = validTimeframes.includes(timeframe) ? timeframe : "1m";

    const result = await runWatchlistScan(watchlistId, tf);

    return NextResponse.json({
      status: "success",
      scan: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scanner run failed";
    console.error("Scanner execution error:", err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
