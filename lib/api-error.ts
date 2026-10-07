import { NextResponse } from "next/server";

/**
 * Logs the real error server-side and returns a generic 500 payload so DB /
 * Upstox internals never leak to clients.
 */
export function serverError(context: string, err: unknown) {
  console.error(`${context}:`, err);
  return NextResponse.json(
    { status: "error", message: "Internal server error. Please try again." },
    { status: 500 }
  );
}
