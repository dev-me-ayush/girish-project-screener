import { NextRequest, NextResponse } from "next/server";
import { getIndexOptionChain, SUPPORTED_INDICES } from "@/lib/upstox";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const underlying = searchParams.get("underlying") || "NSE_INDEX|Nifty 50";

    const valid = SUPPORTED_INDICES.find(
      (i) => i.instrumentKey === underlying || i.symbol === underlying
    );

    if (!valid) {
      return NextResponse.json(
        {
          status: "error",
          message: "Only Nifty 50, Bank Nifty, and Sensex index options are supported.",
        },
        { status: 400 }
      );
    }

    const data = await getIndexOptionChain(valid.instrumentKey);

    return NextResponse.json({
      status: "success",
      underlying: data.underlying,
      options: data.options,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch option chain";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
