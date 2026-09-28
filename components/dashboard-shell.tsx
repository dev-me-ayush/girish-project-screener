"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, Wordmark } from "@/components/logo";
import {
  LayersIcon,
  PanelLeftIcon,
  XIcon,
} from "@/components/icons";
import { signOut } from "@/app/sign-in/actions";

interface DashboardShellProps {
  user: {
    id?: string;
    email: string;
    name?: string;
  };
  children?: React.ReactNode;
}

export function DashboardShell({
  user,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isOverview = pathname === "/dashboard/overview" || pathname === "/dashboard";

  return (
    <div className="relative flex min-h-dvh flex-col bg-white text-black antialiased">
      {/* Short Compact Navigation Header (Height: 48px / h-12) */}
      <header className="sticky top-0 z-40 flex h-12 w-full items-center border-b border-line bg-white/95 px-4 backdrop-blur-md sm:px-6">
        <div className="flex w-full items-center justify-between gap-4">
          {/* Left section: Toggle + Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-black hover:text-black lg:hidden"
            >
              {sidebarOpen ? <XIcon className="h-4 w-4" /> : <PanelLeftIcon className="h-4 w-4" />}
            </button>

            <Link
              href="/"
              className="flex items-center gap-2 text-black transition-opacity hover:opacity-80"
            >
              <Logo className="h-5 w-5 text-black" />
              <Wordmark />
            </Link>

            <div className="hidden items-center gap-2 border-l border-line pl-3 text-xs sm:flex">
              <span className="eyebrow text-faint">Workspace</span>
              <span className="text-muted">/</span>
              <span className="font-medium text-black">Overview</span>
            </div>
          </div>

          {/* Right section: User Profile + Sign Out */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden items-center gap-2 text-right sm:flex">
              <span className="text-xs font-semibold text-black">
                {user.name || "Authenticated User"}
              </span>
              <span className="tabular text-[0.6875rem] text-faint">{user.email}</span>
            </div>

            <span className="hidden h-4 w-px bg-line sm:inline-block" />

            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex h-7 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-medium text-muted transition-colors hover:border-black hover:text-black"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Left-side Panel: Only Overview, nothing else */}
        <aside
          className={`fixed inset-y-12 left-0 z-30 flex w-60 flex-col border-r border-line bg-white transition-transform duration-200 ease-in-out lg:static lg:h-[calc(100dvh-3rem)] lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-1 flex-col p-3">
            <nav aria-label="Main Navigation">
              <Link
                href="/dashboard/overview"
                onClick={() => setSidebarOpen(false)}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  isOverview
                    ? "bg-black text-white shadow-xs"
                    : "text-muted hover:bg-slate-100 hover:text-black"
                }`}
              >
                <LayersIcon
                  className={`h-4 w-4 ${isOverview ? "text-white" : "text-faint group-hover:text-black"}`}
                />
                <span>Overview</span>
              </Link>
            </nav>
          </div>
        </aside>

        {/* Content View: Blank */}
        <main className="flex-1 overflow-y-auto bg-white p-6 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
