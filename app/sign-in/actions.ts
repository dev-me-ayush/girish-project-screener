"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

export type SignInState = {
  error: string | null;
};

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
    return { error: "Failed to connect to Neon database. Please try again." };
  }

  if (shouldRedirect) {
    redirect("/dashboard");
  }

  return { error: null };
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session_user");
  redirect("/sign-in");
}
