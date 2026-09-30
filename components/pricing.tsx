import Link from "next/link";
import { ArrowIcon, CheckIcon } from "@/components/icons";
import { site } from "@/lib/site";

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="reveal max-w-2xl">
          <p className="eyebrow text-signal">{site.pricing.eyebrow}</p>
          <h2 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] tracking-[-0.02em]">
            {site.pricing.title}
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted">
            {site.pricing.body}
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-start">
          {site.pricing.tiers.map((tier, i) => (
            <div
              key={tier.name}
              className={`reveal relative flex h-full flex-col rounded-xl border p-8 transition-colors duration-300 ${
                tier.highlighted
                  ? "border-signal/45 bg-ink-raised shadow-[0_0_50px_-30px_rgba(255,255,255,0.35)]"
                  : "border-line bg-ink hover:border-line-bright"
              }`}
              style={{ "--step": i } as React.CSSProperties}
            >
              {tier.highlighted && (
                <span className="eyebrow absolute -top-2.5 left-8 rounded-full bg-signal px-2.5 py-1 text-ink">
                  Most popular
                </span>
              )}

              <h3 className="text-sm tracking-tight text-paper">{tier.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {tier.blurb}
              </p>

              <p className="mt-7 flex items-baseline gap-2">
                <span className="font-display text-5xl leading-none tracking-tight">
                  {tier.price}
                </span>
                <span className="text-sm text-faint">{tier.cadence}</span>
              </p>

              <Link
                href={tier.href}
                className={`mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-transform duration-200 hover:-translate-y-px active:translate-y-0 ${
                  tier.highlighted
                    ? "bg-signal text-ink"
                    : "border border-line-bright text-paper hover:border-signal/50"
                }`}
              >
                {tier.cta}
                <ArrowIcon className="h-4 w-4" />
              </Link>

              <ul className="mt-8 space-y-3 border-t border-line pt-7">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-muted">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-faint">{site.pricing.note}</p>
      </div>
    </section>
  );
}
