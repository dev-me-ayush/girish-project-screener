"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, Wordmark } from "@/components/logo";
import { site } from "@/lib/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line bg-ink/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-paper transition-opacity hover:opacity-80"
        >
          <Logo className="h-7 w-7 text-black" />
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-black"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={site.signIn.href}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-transform duration-200 hover:-translate-y-px hover:bg-zinc-800 active:translate-y-0"
          >
            {site.signIn.label}
          </Link>
        </div>


        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-paper md:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
            className="h-5 w-5"
          >
            {open ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </>
            ) : (
              <>
                <path d="M4 8h16" />
                <path d="M4 16h16" />
              </>
            )}
          </svg>
        </button>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-line bg-ink/95 backdrop-blur-xl md:hidden"
      >
        <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col px-5 py-3">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="border-b border-line/60 py-3 text-sm text-muted transition-colors last:border-0 hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={site.signIn.href}
            onClick={() => setOpen(false)}
            className="mt-3 mb-2 rounded-full bg-black px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            {site.signIn.label}
          </Link>

        </nav>
      </div>
    </header>
  );
}
