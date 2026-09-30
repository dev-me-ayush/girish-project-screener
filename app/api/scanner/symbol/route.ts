import { NextRequest, NextResponse } from "next/server";
import { getSymbolFibonacciAnalysis } from "@/lib/scanner";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const instrumentKey = searchParams.get("instrumentKey") || undefined;

    if (!symbol) {
      return NextResponse.json(
        { status: "error", message: "Missing required 'symbol' query parameter" },
        { status: 400 }
      );
    }

    const analysis = await getSymbolFibonacciAnalysis(symbol, instrumentKey);

    if (!analysis) {
      return NextResponse.json(
        { status: "error", message: `Symbol not found or analysis failed for ${symbol}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      analysis,
    });
  } catch (err) {
    console.error("Single symbol Fibonacci analysis API error:", err);
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to analyze symbol",
      },
      { status: 500 }
    );
  }
}
