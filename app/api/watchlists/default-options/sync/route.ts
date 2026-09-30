import { NextResponse } from "next/server";
import { syncDefaultOptionsWatchlist } from "@/lib/options-sync";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionEmail = cookieStore.get("session_user")?.value || "girishsir@my.app.com";

    const result = await syncDefaultOptionsWatchlist(sessionEmail);

    return NextResponse.json({
      status: "success",
      message: "Default Options Watchlist synchronized successfully",
      sync: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
