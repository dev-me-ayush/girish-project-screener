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
      className={`font-mono text-xs tabular transition-colors last:border-b-0 hover:bg-slate-50 ${
        isUp ? "bg-emerald-50/30" : isLow ? "bg-rose-50/30" : "bg-white"
      }`}
    >
      {/* Pin Action */}
      <td className="w-10 px-3 py-2.5 text-center">
        <PinButton isPinned={isPinned} onToggle={onTogglePin} />
      </td>

      {/* Index */}
      <td className="w-12 px-3 py-2.5 text-slate-500 font-medium">{index + 1}</td>

      {/* Symbol & Type */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-900">{symbol}</span>
          <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-px font-mono text-[9px] font-semibold text-slate-700">
            {instrument_type}
          </span>
        </div>
      </td>

      {/* 1m LTP */}
      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
        {ltp > 0 ? ltp.toFixed(2) : "--"}
      </td>

      {/* Day Change */}
      <td
        className={`px-3 py-2.5 text-right font-bold ${
          net_change < 0 ? "text-rose-600" : net_change > 0 ? "text-emerald-600" : "text-slate-700"
        }`}
      >
        {net_change !== 0 ? (net_change > 0 ? `+${net_change.toFixed(2)}` : net_change.toFixed(2)) : "0.00"}
      </td>

      {/* Previous Day Reference Levels */}
      <td className="px-3 py-2.5 text-right font-medium text-slate-700">
        {levels.pdh > 0 ? levels.pdh.toFixed(2) : "--"}
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-slate-700">
        {levels.pdl > 0 ? levels.pdl.toFixed(2) : "--"}
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-slate-700">
        {levels.pdc > 0 ? levels.pdc.toFixed(2) : "--"}
      </td>

      {/* Client Fibonacci Levels (0.382 * 1.236 Anchored to Close) */}
      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
        {levels.ac38_2 > 0 ? levels.ac38_2.toFixed(2) : "--"}
      </td>
      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
        {levels.dc38_2 > 0 ? levels.dc38_2.toFixed(2) : "--"}
      </td>

      {/* 1m Breakout Status & Multiple Crossings */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isUp && (
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Up Breakout
            </span>
          )}
          {isLow && (
            <span className="rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 uppercase tracking-wider">
              Low Breakout
            </span>
          )}
          {isInside && (
            <span className="text-slate-500 text-[11px] font-medium">
              {breakout.breachCount > 0 ? `Inside (Was #${breakout.breachCount})` : "--"}
            </span>
          )}

          {breakout.breachCount > 0 && !isInside && (
            <span className="rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
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
                    ? "font-bold text-slate-900"
                    : "text-slate-500"
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
