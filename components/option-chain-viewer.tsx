"use client";

import { useState, useEffect } from "react";
import { SUPPORTED_INDICES, OptionContract } from "@/lib/upstox";
import { InfoTooltip } from "@/components/info-tooltip";

export function OptionChainViewer() {
  const [selectedUnderlying, setSelectedUnderlying] = useState<string>("NSE_INDEX|Nifty 50");
  const [chainData, setChainData] = useState<{
    underlying?: { name: string; spotPrice: number; nearestExpiry: string; atmStrike: number };
    options: OptionContract[];
  }>({ options: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/options/chain?underlying=${encodeURIComponent(selectedUnderlying)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (isMounted && data.status === "success") {
          setChainData({
            underlying: data.underlying,
            options: data.options || [],
          });
        }
      } catch (err) {
        console.error("Failed to load options chain:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [selectedUnderlying]);

  const uniqueStrikes = [
    ...new Set(chainData.options.map((o) => o.strikePrice)),
  ].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-paper sm:text-2xl">
            Index Option Chains (ATM ±7)
          </h1>
          <InfoTooltip text="Strictly current expiry index options constrained to 7 strikes above and below ATM." />
        </div>

        {/* Index Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Underlying Index:</span>
          <select
            value={selectedUnderlying}
            onChange={(e) => setSelectedUnderlying(e.target.value)}
            className="h-8 rounded-lg border border-line bg-ink px-3 text-xs font-semibold text-paper focus:border-signal focus:outline-none"
          >
            {SUPPORTED_INDICES.map((i) => (
              <option key={i.instrumentKey} value={i.instrumentKey}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Spot Price & Expiry Card */}
      {chainData.underlying && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 font-mono">
          <div className="rounded-lg border border-line bg-ink-raised p-3.5">
            <div className="text-[11px] text-faint">INDEX</div>
            <div className="mt-1 text-lg font-bold text-paper">{chainData.underlying.name}</div>
          </div>
          <div className="rounded-lg border border-line bg-ink-raised p-3.5">
            <div className="text-[11px] text-faint">SPOT PRICE</div>
            <div className="mt-1 text-lg font-bold text-paper">
              ₹{chainData.underlying.spotPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-ink-raised p-3.5">
            <div className="text-[11px] text-faint">ATM STRIKE</div>
            <div className="mt-1 text-lg font-bold text-signal">{chainData.underlying.atmStrike}</div>
          </div>
          <div className="rounded-lg border border-line bg-ink-raised p-3.5">
            <div className="text-[11px] text-faint">CURRENT EXPIRY</div>
            <div className="mt-1 text-lg font-bold text-zinc-300">{chainData.underlying.nearestExpiry}</div>
          </div>
        </div>
      )}

      {/* Strict Chain Table */}
      {isLoading ? (
        <div className="rounded-lg border border-dashed border-line p-12 text-center text-xs text-muted">
          Loading ATM ±7 option chain...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-ink-raised">
          <table className="w-full text-center text-xs font-mono">
            <thead className="border-b border-line bg-ink text-faint">
              <tr>
                <th className="px-3 py-2.5 text-left">Call (CE) Trading Symbol</th>
                <th className="px-3 py-2.5">Call Token</th>
                <th className="px-4 py-2.5 bg-zinc-900 text-paper font-bold">Strike Price</th>
                <th className="px-3 py-2.5">Distance</th>
                <th className="px-3 py-2.5">Put Token</th>
                <th className="px-3 py-2.5 text-right">Put (PE) Trading Symbol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {uniqueStrikes.map((strike) => {
                const isAtm = strike === chainData.underlying?.atmStrike;
                const call = chainData.options.find(
                  (o) => o.strikePrice === strike && o.optionType === "CE"
                );
                const put = chainData.options.find(
                  (o) => o.strikePrice === strike && o.optionType === "PE"
                );

                const distance = call?.distanceFromAtm ?? put?.distanceFromAtm ?? 0;
                const distLabel =
                  distance === 0
                    ? "ATM"
                    : distance > 0
                    ? `+${distance} OTM`
                    : `${distance} ITM`;

                return (
                  <tr
                    key={strike}
                    className={`transition-colors hover:bg-ink/50 ${
                      isAtm ? "bg-zinc-800/80 font-bold" : ""
                    }`}
                  >
                    {/* Call Symbol */}
                    <td className="px-3 py-2.5 text-left text-zinc-200">
                      {call?.tradingSymbol || "--"}
                    </td>

                    {/* Call Token */}
                    <td className="px-3 py-2.5 text-zinc-500">
                      {call?.instrumentKey.split("|")[1] || "--"}
                    </td>

                    {/* Strike */}
                    <td
                      className={`px-4 py-2.5 text-sm font-bold ${
                        isAtm ? "bg-signal text-ink" : "bg-zinc-900/90 text-paper"
                      }`}
                    >
                      {strike}
                    </td>

                    {/* Distance */}
                    <td className="px-3 py-2.5 text-zinc-400">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                          isAtm
                            ? "bg-zinc-800 text-paper font-bold"
                            : "text-zinc-500"
                        }`}
                      >
                        {distLabel}
                      </span>
                    </td>

                    {/* Put Token */}
                    <td className="px-3 py-2.5 text-zinc-500">
                      {put?.instrumentKey.split("|")[1] || "--"}
                    </td>

                    {/* Put Symbol */}
                    <td className="px-3 py-2.5 text-right text-zinc-200">
                      {put?.tradingSymbol || "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
