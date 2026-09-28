import { QuoteIcon } from "@/components/icons";
import { site } from "@/lib/site";

export function Testimonials() {
  return (
    <section className="border-t border-line py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="eyebrow reveal text-signal">From the desk</p>

        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {site.testimonials.map((item, i) => (
            <li
              key={item.name}
              className="reveal flex flex-col rounded-xl border border-line bg-ink-raised p-7"
              style={{ "--step": i } as React.CSSProperties}
            >
              <QuoteIcon className="h-7 w-7 text-signal" />
              <blockquote className="mt-5 flex-1 text-[0.9375rem] leading-relaxed text-paper">
                {item.quote}
              </blockquote>
              <figcaption className="mt-7 flex items-center gap-3 border-t border-line pt-5">
                <span className="tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-bright text-xs text-signal">
                  {item.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-paper">
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {item.role}
                  </span>
                </span>
              </figcaption>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
