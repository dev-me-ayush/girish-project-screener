import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Returns the authenticated session email, or null when signed out. */
export async function getSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get("session_user")?.value?.trim();
  return value ? value : null;
}

/** 401 JSON response for unauthenticated API callers. */
export function unauthorizedResponse() {
  return NextResponse.json(
    { status: "error", message: "Unauthorized. Please sign in." },
    { status: 401 }
  );
}
