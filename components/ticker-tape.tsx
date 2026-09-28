import { site } from "@/lib/site";

export function TickerTape() {
  const items = [...site.market.tape, ...site.market.tape];

  return (
    <div className="border-b border-line bg-ink-raised/70">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-5 px-5 sm:px-8">
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-faint" />
          <span className="eyebrow text-muted">{site.market.status}</span>
        </div>

        <div
          className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]"
          aria-hidden
        >
          <div className="tape-track flex w-max items-center">
            {items.map((item, i) => (
              <div
                key={`${item.label}-${i}`}
                className="flex items-center gap-2.5 border-r border-line py-2.5 pr-6 pl-6 first:pl-0"
              >
                <span className="eyebrow text-faint">{item.label}</span>
                <span className="tabular text-sm text-paper">{item.value}</span>
                <span
                  className={`tabular text-xs ${item.up ? "text-signal" : "text-drop"}`}
                >
                  {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>

        <span className="eyebrow hidden shrink-0 text-faint sm:block">
          {site.market.stamp}
        </span>
      </div>
    </div>
  );
}
