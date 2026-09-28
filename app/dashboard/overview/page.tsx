import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = {
  title: "Overview · Dashboard",
  description: "Workspace overview.",
  robots: { index: false, follow: false },
};

export default async function DashboardOverviewPage() {
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
      {/* Blank overview page */}
    </DashboardShell>
  );
}
