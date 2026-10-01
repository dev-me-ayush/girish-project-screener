import { NextRequest, NextResponse } from "next/server";
import { getUserPinnedSymbols, togglePinnedSymbol } from "@/lib/scanner/pinned-watchlist";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function resolveSessionEmail(searchEmail: string | null, bodyEmail?: string) {
  const cookieStore = await cookies();
  const sessionEmail = cookieStore.get("session_user")?.value || "girishsir@my.app.com";
  return (searchEmail || bodyEmail || sessionEmail || "girishsir@my.app.com").trim();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = await resolveSessionEmail(searchParams.get("email"));
    const items = await getUserPinnedSymbols(email);
    return NextResponse.json({ status: "success", count: items.length, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load pinned symbols";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, instrumentKey, instrumentType, email } = body;

    if (!symbol || !instrumentKey) {
      return NextResponse.json({ status: "error", message: "symbol and instrumentKey are required" }, { status: 400 });
    }

    const result = await togglePinnedSymbol(
      symbol,
      instrumentKey,
      instrumentType || "EQUITY",
      await resolveSessionEmail(null, email)
    );

    return NextResponse.json({ status: "success", ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to toggle pin";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
