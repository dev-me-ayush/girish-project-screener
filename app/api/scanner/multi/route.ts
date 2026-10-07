import { NextRequest, NextResponse } from "next/server";
import { runMultiWatchlistScan } from "@/lib/scanner";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const watchlistIdsParam = searchParams.get("watchlistIds");
    const watchlistIds = watchlistIdsParam
      ? watchlistIdsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)
      : undefined;

    const scan = await runMultiWatchlistScan(watchlistIds);

    return NextResponse.json({
      status: "success",
      scan,
    });
  } catch (err) {
    return serverError("Multi-watchlist scan API error", err);
  }
}
