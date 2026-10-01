"use client";

import React from "react";
import { UnifiedScannedInstrument } from "@/lib/scanner/market-coordinator";
import { PinButton } from "./pin-button";

interface ScannerRowProps {
  index: number;
  item: UnifiedScannedInstrument;
  isPinned: boolean;
  onTogglePin: () => void;
}

export function ScannerRow({ index, item, isPinned, onTogglePin }: ScannerRowProps) {
  const { symbol, instrument_type, ltp, net_change, levels, breakout } = item;
  const isUp = breakout.direction === "UP";
  const isLow = breakout.direction === "LOW";
  const isInside = breakout.direction === "INSIDE";

  return (
    <tr
      className={`font-mono text-xs tabular transition-colors last:border-b-0 hover:bg-zinc-900/40 ${
        isUp ? "bg-zinc-900/20" : isLow ? "bg-red-950/10" : ""
      }`}
    >
      {/* Pin Action */}
      <td className="w-10 px-3 py-2.5 text-center">
        <PinButton isPinned={isPinned} onToggle={onTogglePin} />
      </td>

      {/* Index */}
      <td className="w-12 px-3 py-2.5 text-zinc-500">{index + 1}</td>

      {/* Symbol & Type */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-paper">{symbol}</span>
          <span className="rounded border border-line bg-zinc-900 px-1 py-px font-mono text-[9px] text-zinc-400">
            {instrument_type}
          </span>
        </div>
      </td>

      {/* 1m LTP */}
      <td className="px-3 py-2.5 text-right font-medium text-paper">
        {ltp > 0 ? ltp.toFixed(2) : "--"}
      </td>

      {/* Day Change */}
      <td
        className={`px-3 py-2.5 text-right ${
          net_change < 0 ? "text-drop" : "text-paper"
        }`}
      >
        {net_change !== 0 ? (net_change > 0 ? `+${net_change.toFixed(2)}` : net_change.toFixed(2)) : "0.00"}
      </td>

      {/* Previous Day Reference Levels */}
      <td className="px-3 py-2.5 text-right text-zinc-400">
        {levels.pdh > 0 ? levels.pdh.toFixed(2) : "--"}
      </td>
      <td className="px-3 py-2.5 text-right text-zinc-400">
        {levels.pdl > 0 ? levels.pdl.toFixed(2) : "--"}
      </td>
      <td className="px-3 py-2.5 text-right text-zinc-300 font-medium">
        {levels.pdc > 0 ? levels.pdc.toFixed(2) : "--"}
      </td>

      {/* Client Fibonacci Levels (0.382 * 1.236 Anchored to Close) */}
      <td className="px-3 py-2.5 text-right font-medium text-paper">
        {levels.ac38_2 > 0 ? levels.ac38_2.toFixed(2) : "--"}
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-zinc-300">
        {levels.dc38_2 > 0 ? levels.dc38_2.toFixed(2) : "--"}
      </td>

      {/* 1m Breakout Status & Multiple Crossings */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isUp && (
            <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-bold text-ink uppercase tracking-wider">
              Up Breakout
            </span>
          )}
          {isLow && (
            <span className="rounded-full border border-red-900/50 bg-red-950/30 px-2 py-0.5 text-[10px] font-bold text-drop uppercase tracking-wider">
              Low Breakout
            </span>
          )}
          {isInside && (
            <span className="text-zinc-600 text-[11px]">
              {breakout.breachCount > 0 ? `Inside (Was #${breakout.breachCount})` : "--"}
            </span>
          )}

          {breakout.breachCount > 0 && !isInside && (
            <span className="rounded-full border border-line bg-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-300">
              Trigger #{breakout.breachCount}
            </span>
          )}
        </div>
      </td>

      {/* Breakout Timestamp / All Trigger Timings */}
      <td className="px-3 py-2.5 text-right font-mono text-[11px]">
        {breakout.breachTimes && breakout.breachTimes.length > 0 ? (
          <div className="flex flex-col items-end gap-0.5">
            {breakout.breachTimes.map((t, idx) => (
              <span
                key={idx}
                className={
                  idx === breakout.breachTimes.length - 1
                    ? "font-semibold text-paper"
                    : "text-zinc-500"
                }
              >
                #{idx + 1}: {t}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-zinc-500">{breakout.latestBreachTime || "--"}</span>
        )}
      </td>
    </tr>
  );
}
