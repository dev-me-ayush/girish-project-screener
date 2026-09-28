import { site } from "@/lib/site";
import type { ScreenerStock } from "@/lib/stocks";

const columns = ["Symbol", "LTP", "Chg", "RSI", "Vol", "Mkt cap"];

export function ScannerPreview({ stocks }: { stocks?: ScreenerStock[] }) {
  const displayRows = stocks && stocks.length > 0 ? stocks : site.screener.rows;

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-panel shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-signal/60 to-transparent" />

      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-line-bright" />
        <span className="h-2 w-2 rounded-full bg-line-bright" />
        <span className="h-2 w-2 rounded-full bg-line-bright" />
        <span className="eyebrow ml-2 text-faint">{site.screener.label}</span>
        <span className="tabular ml-auto text-[0.6875rem] text-signal">236ms</span>
      </div>

      <div className="border-b border-line bg-ink-raised px-4 py-3">
        <code className="tabular block text-[0.7rem] leading-relaxed break-words text-signal/90 sm:text-[0.75rem]">
          <span className="text-faint">$</span> {site.screener.query}
        </code>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-0 z-10 sweep-line bg-gradient-to-b from-transparent via-signal/[0.07] to-transparent" />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {columns.map((col, i) => (
                  <th
                    key={col}
                    scope="col"
                    className={`eyebrow px-3 py-2.5 font-normal whitespace-nowrap text-faint first:pl-4 ${
                      i === 0 ? "w-[26%]" : ""
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr
                  key={row.symbol}
                  className="border-b border-line/50 transition-colors last:border-0 hover:bg-ink-raised"
                >
                  <td className="px-3 py-2.5 pl-4">
                    <span className="tabular block text-[0.8125rem] tracking-tight text-paper">
                      {row.symbol}
                    </span>
                    <span className="block truncate text-[0.6875rem] text-faint">
                      {row.name}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-[0.8125rem] whitespace-nowrap text-paper">
                    {row.price}
                  </td>
                  <td
                    className={`tabular px-3 py-2.5 text-[0.8125rem] whitespace-nowrap ${
                      row.up ? "text-signal" : "text-drop"
                    }`}
                  >
                    {row.change}
                  </td>
                  <td className="tabular px-3 py-2.5 text-[0.8125rem] text-muted">
                    {row.rsi}
                  </td>
                  <td className="tabular px-3 py-2.5 text-[0.8125rem] whitespace-nowrap text-muted">
                    {row.volume}
                  </td>
                  <td className="tabular px-3 py-2.5 text-[0.8125rem] whitespace-nowrap text-muted">
                    {row.cap}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
        <span className="eyebrow text-faint">5 of 218 matches · NSE + BSE</span>
        <span className="flex items-center gap-1.5">
          {[0, 150, 300, 450].map((delay) => (
            <span
              key={delay}
              className="blip h-1 w-1 rounded-full bg-signal"
              style={{ "--delay": `${delay}ms` } as React.CSSProperties}
            />
          ))}
        </span>
      </div>

      <p className="border-t border-line px-4 py-2.5 text-[0.6875rem] leading-relaxed text-faint">
        {site.screener.note}
      </p>
    </div>
  );
}
