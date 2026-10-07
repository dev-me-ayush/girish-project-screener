import { NextRequest, NextResponse } from "next/server";
import { runWatchlistScan } from "@/lib/scanner";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const VALID_TIMEFRAMES = ["1m", "2m", "3m", "5m", "15m"] as const;

export async function POST(req: NextRequest) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { status: "error", message: "Invalid request body" },
        { status: 400 }
      );
    }
    const { watchlistId, timeframe = "1m" } = (body || {}) as Record<string, unknown>;

    if (typeof watchlistId !== "string" || !watchlistId) {
      return NextResponse.json(
        { status: "error", message: "watchlistId is required" },
        { status: 400 }
      );
    }

    const tf = typeof timeframe === "string" && (VALID_TIMEFRAMES as readonly string[]).includes(timeframe)
      ? (timeframe as (typeof VALID_TIMEFRAMES)[number])
      : "1m";

    const result = await runWatchlistScan(watchlistId, tf);

    return NextResponse.json({
      status: "success",
      scan: result,
    });
  } catch (err: unknown) {
    return serverError("Scanner execution error", err);
  }
}
