import { NextRequest, NextResponse } from "next/server";
import { runHeadlessBackgroundScan } from "@/lib/scanner";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Expensive full scan: scheduler (CRON_SECRET bearer) or signed-in user.
    if (!isCronAuthorized(req)) {
      const sessionEmail = await getSessionEmail();
      if (!sessionEmail) return unauthorizedResponse();
    }
    const report = await runHeadlessBackgroundScan();
    return NextResponse.json({
      status: "success",
      report,
    });
  } catch (err: unknown) {
    return serverError("Daemon scan error", err);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
