import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { site } from "@/lib/site";

export function ClosingCta() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="bloom reveal relative overflow-hidden rounded-2xl border border-line bg-ink-raised px-7 py-16 text-center sm:px-16 sm:py-24">
          <div className="graph pointer-events-none absolute inset-0 -z-10 opacity-70" />

          <h2 className="mx-auto max-w-3xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.02em]">
            {site.cta.title}
          </h2>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-muted">
            {site.cta.body}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={site.cta.primary.href}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-signal px-7 text-sm font-medium text-ink transition-transform duration-200 hover:-translate-y-px active:translate-y-0"
            >
              {site.cta.primary.label}
              <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={site.cta.secondary.href}
              className="inline-flex h-12 items-center rounded-full border border-line-bright px-7 text-sm text-paper transition-colors hover:border-signal/50 hover:bg-ink"
            >
              {site.cta.secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
