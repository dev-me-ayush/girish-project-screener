import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo, Wordmark } from "@/components/logo";
import { SignInForm } from "@/components/sign-in-form";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Tessera account.",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (sessionUser) {
    redirect("/dashboard/overview");
  }
  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-black">
      <header className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-black transition-opacity hover:opacity-80"
        >
          <Logo className="h-7 w-7 text-black" />
          <Wordmark />
        </Link>
      </header>

      <main className="flex flex-1 items-center px-5 py-10 sm:px-8">
        <div className="mx-auto grid w-full max-w-5xl gap-14 lg:grid-cols-12 lg:items-center">
          <div className="rise lg:col-span-6 lg:col-start-3">
            <div className="mx-auto w-full max-w-sm">
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-black">
                Welcome back
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Sign in to access your equities workspace, screens, and watchlists.
              </p>

              <div className="mt-8">
                <SignInForm />
              </div>

              <p className="mt-8 border-t border-line pt-6 text-xs leading-relaxed text-faint">
                Signing in means you accept our{" "}
                <Link
                  href="#"
                  className="text-muted underline underline-offset-4 transition-colors hover:text-black"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="#"
                  className="text-muted underline underline-offset-4 transition-colors hover:text-black"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>

          <aside className="hidden lg:col-span-4 lg:col-start-9 lg:block">
            <div className="rounded-xl border border-line bg-slate-50/60 p-7">
              <p className="eyebrow text-faint font-semibold">{site.market.status}</p>
              <dl className="mt-5 space-y-3.5">
                {site.market.tape.slice(0, 5).map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="eyebrow text-faint">{row.label}</dt>
                    <dd className="tabular flex items-baseline gap-2.5 text-sm">
                      <span className="font-medium text-black">{row.value}</span>
                      <span
                        className={`text-xs font-medium ${row.up ? "text-black" : "text-drop"}`}
                      >
                        {row.change}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 border-t border-line pt-4 text-[0.6875rem] leading-relaxed text-faint">
                {site.footer.disclaimer}
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

