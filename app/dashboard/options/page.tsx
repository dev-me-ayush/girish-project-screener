import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardOptionsPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get("session_user")?.value) {
    redirect("/sign-in");
  }
  redirect("/dashboard/scanner");
}
