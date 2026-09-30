import { NextRequest, NextResponse } from "next/server";
import { runFullMarketScan } from "@/lib/scanner/market-coordinator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const payload = await runFullMarketScan(force);

    return NextResponse.json({
      status: "success",
      ...payload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to run market scan";
    console.error("Market scan error:", err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
