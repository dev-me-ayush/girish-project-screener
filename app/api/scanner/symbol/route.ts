import { NextRequest, NextResponse } from "next/server";
import { getSymbolFibonacciAnalysis } from "@/lib/scanner";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const rawSymbol = (searchParams.get("symbol") || "").trim().toUpperCase();
    const instrumentKey = searchParams.get("instrumentKey")?.trim() || undefined;

    if (!rawSymbol || rawSymbol.length > 40 || !/^[A-Z0-9&+_.\-]+$/.test(rawSymbol)) {
      return NextResponse.json(
        { status: "error", message: "Valid 'symbol' query parameter is required" },
        { status: 400 }
      );
    }
    if (instrumentKey && instrumentKey.length > 120) {
      return NextResponse.json(
        { status: "error", message: "Invalid 'instrumentKey' query parameter" },
        { status: 400 }
      );
    }

    const analysis = await getSymbolFibonacciAnalysis(rawSymbol, instrumentKey);

    if (!analysis) {
      return NextResponse.json(
        { status: "error", message: `Symbol not found or analysis failed for ${rawSymbol}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      analysis,
    });
  } catch (err) {
    return serverError("Single symbol Fibonacci analysis API error", err);
  }
}
