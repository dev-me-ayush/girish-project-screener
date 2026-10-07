import { NextResponse } from "next/server";
import { getHeaderIndicesQuotes } from "@/lib/upstox";
import { getSessionEmail, unauthorizedResponse } from "@/lib/session";
import { serverError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail) return unauthorizedResponse();

    const indices = await getHeaderIndicesQuotes();
    return NextResponse.json({
      status: "success",
      updatedAt: new Date().toISOString(),
      indices,
    });
  } catch (err: unknown) {
    return serverError("Failed to fetch indices", err);
  }
}
