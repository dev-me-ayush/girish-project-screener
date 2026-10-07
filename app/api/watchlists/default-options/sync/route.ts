import { NextResponse } from "next/server";
import { syncDefaultOptionsWatchlist } from "@/lib/options-sync";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();

    const result = await syncDefaultOptionsWatchlist(sessionEmail);

    return NextResponse.json({
      status: "success",
      message: "Default Options Watchlist synchronized successfully",
      sync: result,
    });
  } catch (err: unknown) {
    return serverError("Sync failed", err);
  }
}

export async function GET() {
  return POST();
}
