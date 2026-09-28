import { featureIcons } from "@/components/icons";
import { site } from "@/lib/site";

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="reveal grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow text-signal">{site.features.eyebrow}</p>
            <h2 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] tracking-[-0.02em]">
              {site.features.title}
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-base leading-relaxed text-muted">
              {site.features.body}
            </p>
          </div>
        </div>

        <ul className="mt-16 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {site.features.items.map((item, i) => {
            const Icon = featureIcons[item.icon as keyof typeof featureIcons];
            return (
              <li
                key={item.title}
                className="reveal group relative bg-ink p-7 transition-colors duration-300 hover:bg-ink-raised"
                style={{ "--step": i } as React.CSSProperties}
              >
                <span className="absolute inset-x-0 top-0 h-px scale-x-0 bg-signal transition-transform duration-500 group-hover:scale-x-100" />
                <Icon className="h-6 w-6 text-signal" />
                <h3 className="mt-5 text-lg tracking-tight">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
