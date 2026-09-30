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
      className={`border-b border-zinc-800/60 font-mono text-xs transition-colors hover:bg-zinc-900/40 ${
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
          <span className="font-semibold text-white">{symbol}</span>
          <span className="rounded bg-zinc-900 px-1 py-0.2 text-[9px] text-zinc-400 border border-zinc-800">
            {instrument_type}
          </span>
        </div>
      </td>

      {/* 5m LTP */}
      <td className="px-3 py-2.5 text-right font-medium text-white">
        {ltp > 0 ? ltp.toFixed(2) : "--"}
      </td>

      {/* Day Change */}
      <td
        className={`px-3 py-2.5 text-right ${
          net_change < 0 ? "text-red-400" : "text-white"
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
      <td className="px-3 py-2.5 text-right font-medium text-white">
        {levels.ac38_2 > 0 ? levels.ac38_2.toFixed(2) : "--"}
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-zinc-300">
        {levels.dc38_2 > 0 ? levels.dc38_2.toFixed(2) : "--"}
      </td>

      {/* 5m Breakout Status & Multiple Crossings */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {isUp && (
            <span className="rounded border border-zinc-600 bg-white px-2 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider">
              Up Breakout
            </span>
          )}
          {isLow && (
            <span className="rounded border border-red-900 bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-300 uppercase tracking-wider">
              Low Breakout
            </span>
          )}
          {isInside && (
            <span className="text-zinc-600 text-[11px]">
              {breakout.breachCount > 0 ? `Inside (${breakout.breachCount}x)` : "--"}
            </span>
          )}

          {breakout.breachCount > 1 && !isInside && (
            <span className="rounded bg-zinc-800 px-1 py-0.2 text-[9px] text-zinc-300">
              {breakout.breachCount}x
            </span>
          )}
        </div>
      </td>

      {/* Breakout Timestamp */}
      <td className="px-3 py-2.5 text-right text-zinc-400 text-[11px]">
        {breakout.latestBreachTime || "--"}
      </td>
    </tr>
  );
}
