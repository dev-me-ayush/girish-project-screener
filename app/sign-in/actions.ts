"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

export type SignInState = {
  error: string | null;
};

// In-memory sign-in rate limit: 5 attempts per email per 10 minutes.
// Per-instance only; sufficient to blunt credential-stuffing on a single host.
const signInAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = signInAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    signInAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (typeof password !== "string" || !password) {
    return { error: "Password is required." };
  }

  let shouldRedirect = false;

  try {
    const normalizedEmail = email.trim().toLowerCase();

    if (isRateLimited(normalizedEmail)) {
      return { error: "Too many attempts. Please try again later." };
    }

    const users = await sql`
      SELECT id, email, password_hash FROM users WHERE email = ${normalizedEmail} LIMIT 1
    `;

    if (users.length === 0) {
      return { error: "Invalid email or password." };
    }

    const user = users[0];
    const storedHash = (user.password_hash as string) || "";

    const isValid = verifyPassword(password, storedHash);
    if (!isValid) {
      return { error: "Invalid email or password." };
    }

    const cookieStore = await cookies();
    cookieStore.set("session_user", user.email as string, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    shouldRedirect = true;
  } catch (error) {
    console.error("Neon authentication error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  if (shouldRedirect) {
    redirect("/dashboard/overview");
  }

  return { error: null };

}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: "session_user", path: "/" });
  redirect("/sign-in");
}
