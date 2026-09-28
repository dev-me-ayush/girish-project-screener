import { site } from "@/lib/site";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="reveal lg:col-span-4">
            <p className="eyebrow text-signal">{site.faq.eyebrow}</p>
            <h2 className="mt-5 font-display text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">
              {site.faq.title}
            </h2>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              Still stuck? Write to{" "}
              <a
                href="mailto:support@tessera.example"
                className="text-signal underline underline-offset-4 transition-colors hover:text-paper"
              >
                support@tessera.example
              </a>{" "}
              and a human answers within a day.
            </p>
          </div>

          <div className="lg:col-span-8">
            <ul className="border-t border-line">
              {site.faq.items.map((item, i) => (
                <li key={item.q} className="reveal border-b border-line" style={{ "--step": i } as React.CSSProperties}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left text-base tracking-tight transition-colors hover:text-signal [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
                      {item.q}
                      <span
                        aria-hidden
                        className="relative mt-1.5 h-3.5 w-3.5 shrink-0 text-signal transition-transform duration-300 group-open:rotate-90"
                      >
                        <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-current" />
                        <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-current" />
                      </span>
                    </summary>
                    <p className="max-w-2xl pr-10 pb-7 text-sm leading-relaxed text-muted">
                      {item.a}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
