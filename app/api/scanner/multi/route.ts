import { NextRequest, NextResponse } from "next/server";
import { runMultiWatchlistScan } from "@/lib/scanner";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const watchlistIdsParam = searchParams.get("watchlistIds");
    const watchlistIds = watchlistIdsParam
      ? watchlistIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const scan = await runMultiWatchlistScan(watchlistIds);

    return NextResponse.json({
      status: "success",
      scan,
    });
  } catch (err) {
    console.error("Multi-watchlist scan API error:", err);
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to execute multi-watchlist scan",
      },
      { status: 500 }
    );
  }
}
