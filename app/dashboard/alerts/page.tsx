import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import { BreakoutAlertsView } from "@/components/scanner/breakout-alerts-view";

export const metadata: Metadata = {
  title: "Breakout Alerts · Dashboard",
  description: "Live institutional feed of confirmed 5m Fibonacci AC/DC 38.2% breakout events.",
  robots: { index: false, follow: false },
};

export default async function DashboardAlertsPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (!sessionUser) {
    redirect("/sign-in");
  }

  const users = await sql`
    SELECT id, email, name FROM users WHERE email = ${sessionUser} LIMIT 1
  `;
  if (users.length === 0) {
    redirect("/sign-in");
  }
  const user = users[0] as {
    id?: string;
    email: string;
    name?: string;
  };

  return (
    <DashboardShell user={user}>
      <BreakoutAlertsView />
    </DashboardShell>
  );
}
