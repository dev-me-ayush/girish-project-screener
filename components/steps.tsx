import { site } from "@/lib/site";

export function Steps() {
  return (
    <section className="border-t border-line bg-ink-raised py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="eyebrow reveal text-signal">{site.steps.eyebrow}</p>
        <h2 className="reveal mt-5 max-w-2xl font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] tracking-[-0.02em]">
          {site.steps.title}
        </h2>

        <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {site.steps.items.map((item, i) => (
            <li
              key={item.step}
              className="reveal relative border-t border-line-bright pt-6"
              style={{ "--step": i } as React.CSSProperties}
            >
              <span className="tabular text-sm text-signal">{item.step}</span>
              <h3 className="mt-4 font-display text-2xl tracking-tight">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
