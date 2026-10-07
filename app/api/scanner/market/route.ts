import { NextRequest, NextResponse } from "next/server";
import { runFullMarketScan } from "@/lib/scanner/market-coordinator";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const payload = await runFullMarketScan(force);

    return NextResponse.json({
      status: "success",
      ...payload,
    });
  } catch (err: unknown) {
    return serverError("Market scan error", err);
  }
}
