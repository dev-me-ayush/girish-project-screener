import { NextRequest, NextResponse } from "next/server";
import { getUserPinnedSymbols, togglePinnedSymbol } from "@/lib/scanner/pinned-watchlist";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const VALID_INSTRUMENT_TYPES = ["EQUITY", "OPTION"];

export async function GET() {
  try {
    const email = await getSessionEmail();
    if (!email) return unauthorizedResponse();
    const items = await getUserPinnedSymbols(email);
    return NextResponse.json({ status: "success", count: items.length, items });
  } catch (err: unknown) {
    return serverError("Load pinned symbols error", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const email = await getSessionEmail();
    if (!email) return unauthorizedResponse();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
    }
    const { symbol, instrumentKey, instrumentType } = (body || {}) as Record<string, unknown>;

    if (typeof symbol !== "string" || !symbol.trim() || symbol.trim().length > 60) {
      return NextResponse.json({ status: "error", message: "Valid symbol is required" }, { status: 400 });
    }
    if (typeof instrumentKey !== "string" || !instrumentKey.trim() || instrumentKey.length > 120) {
      return NextResponse.json({ status: "error", message: "Valid instrumentKey is required" }, { status: 400 });
    }
    const typeValue = (typeof instrumentType === "string" && VALID_INSTRUMENT_TYPES.includes(instrumentType)
      ? instrumentType
      : "EQUITY") as "EQUITY" | "OPTION";

    const result = await togglePinnedSymbol(
      symbol.trim(),
      instrumentKey.trim(),
      typeValue,
      email
    );

    return NextResponse.json({ status: "success", ...result });
  } catch (err: unknown) {
    return serverError("Toggle pin error", err);
  }
}
