"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, Wordmark } from "@/components/logo";
import { site } from "@/lib/site";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line bg-ink/90 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-paper transition-opacity hover:opacity-85"
        >
          <Logo className="h-6 w-6 text-paper" />
          <Wordmark />
        </Link>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <Link
            href={site.signIn.href}
            className="rounded-lg bg-paper px-4 py-2 text-xs font-mono font-bold whitespace-nowrap text-ink transition-all hover:bg-zinc-200 active:scale-95 shadow-xs"
          >
            {site.signIn.label}
          </Link>
        </div>
      </div>
    </header>
  );
}

