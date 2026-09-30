import { NextResponse } from "next/server";
import { runHeadlessBackgroundScan } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await runHeadlessBackgroundScan();
    return NextResponse.json({
      status: "success",
      report,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Daemon scanner failed";
    console.error("Daemon scan error:", err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
