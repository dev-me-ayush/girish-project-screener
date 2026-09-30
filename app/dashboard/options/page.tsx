import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import { OptionChainViewer } from "@/components/option-chain-viewer";

export const metadata: Metadata = {
  title: "Option Chains · Dashboard",
  description: "Browse current expiry ATM ±7 strikes for Nifty, Bank Nifty, and Sensex.",
  robots: { index: false, follow: false },
};

export default async function DashboardOptionsPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (!sessionUser) {
    redirect("/sign-in");
  }

  const users = await sql`
    SELECT id, email, name FROM users WHERE email = ${sessionUser} LIMIT 1
  `;
  const user = (users[0] as {
    id?: string;
    email: string;
    name?: string;
  }) || {
    email: sessionUser,
  };

  return (
    <DashboardShell user={user}>
      <OptionChainViewer />
    </DashboardShell>
  );
}
