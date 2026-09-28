import { site } from "@/lib/site";

export function Stats() {
  return (
    <section className="border-y border-line py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
          {site.stats.map((item, i) => (
            <div
              key={item.label}
              className="reveal border-l border-line pl-5"
              style={{ "--step": i } as React.CSSProperties}
            >
              <dt className="tabular text-4xl leading-none tracking-tight text-paper sm:text-5xl">
                {item.value}
              </dt>
              <dd className="mt-3 text-sm leading-snug text-muted">
                {item.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
