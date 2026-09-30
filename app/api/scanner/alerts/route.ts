import { NextRequest, NextResponse } from "next/server";
import { getScannerAlertHistory } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const watchlistId = searchParams.get("watchlistId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const alerts = await getScannerAlertHistory(watchlistId, limit);

    return NextResponse.json({
      status: "success",
      count: alerts.length,
      alerts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load alerts";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
