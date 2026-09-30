import { NextResponse } from "next/server";
import { getHeaderIndicesQuotes } from "@/lib/upstox";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const indices = await getHeaderIndicesQuotes();
    return NextResponse.json({
      status: "success",
      updatedAt: new Date().toISOString(),
      indices,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch indices";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
