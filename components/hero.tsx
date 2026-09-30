import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { ScannerPreview } from "@/components/scanner-preview";
import { site } from "@/lib/site";
import type { ScreenerStock } from "@/lib/stocks";

export function Hero({ stocks }: { stocks?: ScreenerStock[] }) {
  return (
    <section className="bloom relative overflow-hidden py-16 sm:py-24">
      <div className="graph pointer-events-none absolute inset-0 -z-10" />

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="blip h-1.5 w-1.5 rounded-full bg-signal" style={{ "--delay": "0ms" } as React.CSSProperties} />
          <span className="eyebrow text-signal">{site.hero.eyebrow}</span>
        </div>

        <h1 className="rise mt-7 max-w-4xl font-display text-[clamp(3.25rem,10vw,7.5rem)] leading-[0.9] tracking-[-0.02em]"
            style={{ "--delay": "80ms" } as React.CSSProperties}>
          {site.hero.headline[0]}
          <br />
          <span className="italic text-signal">{site.hero.headline[1]}</span>
        </h1>

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:items-end">
          <div className="rise lg:col-span-5" style={{ "--delay": "200ms" } as React.CSSProperties}>
            <p className="max-w-md text-lg leading-relaxed text-muted">
              {site.hero.lede}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={site.hero.primary.href}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-signal px-6 text-sm font-medium text-ink transition-transform duration-200 hover:-translate-y-px active:translate-y-0"
              >
                {site.hero.primary.label}
                <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <div
            id="screener"
            className="rise scroll-mt-24 lg:col-span-7"
            style={{ "--delay": "320ms" } as React.CSSProperties}
          >
            <ScannerPreview stocks={stocks} />
          </div>
        </div>
      </div>
    </section>
  );
}
