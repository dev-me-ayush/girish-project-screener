"use client";

import React, { useState } from "react";
import { UnifiedScannedInstrument } from "@/lib/scanner/market-coordinator";
import { ScannerRow } from "./scanner-row";

interface ScannerTableProps {
  instruments: UnifiedScannedInstrument[];
  pinnedSet: Set<string>;
  onTogglePin: (instrument: UnifiedScannedInstrument) => void;
  pageSize?: number;
}

export function ScannerTable({
  instruments,
  pinnedSet,
  onTogglePin,
  pageSize = 50,
}: ScannerTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(instruments.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const currentChunk = instruments.slice(startIndex, startIndex + pageSize);

  return (
    <section
      aria-label="1-minute screener results"
      aria-live="polite"
      className="fade-in overflow-hidden rounded-xl border border-line bg-panel font-mono shadow-sm"
    >
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-zinc-950/60 text-[11px] uppercase tracking-[0.12em] text-zinc-400">
              <th className="w-10 px-3 py-3 text-center font-medium">Pin</th>
              <th className="w-12 px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Symbol</th>
              <th className="px-3 py-3 text-right font-medium">1m LTP</th>
              <th className="px-3 py-3 text-right font-medium">Day Chg</th>
              <th className="px-3 py-3 text-right font-medium">PDH</th>
              <th className="px-3 py-3 text-right font-medium">PDL</th>
              <th className="px-3 py-3 text-right font-medium">PDC</th>
              <th className="px-3 py-3 text-right font-medium">AC 38.2%</th>
              <th className="px-3 py-3 text-right font-medium">DC 38.2%</th>
              <th className="px-3 py-3 font-medium">1m Status</th>
              <th className="px-3 py-3 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {currentChunk.length > 0 ? (
              currentChunk.map((item, idx) => (
                <ScannerRow
                  key={item.symbol}
                  index={startIndex + idx}
                  item={item}
                  isPinned={pinnedSet.has(item.symbol)}
                  onTogglePin={() => onTogglePin(item)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center">
                  <p className="font-sans text-sm font-medium text-paper">No matching instruments</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Try another filter tab — or hit Refresh.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-line bg-ink/60 px-4 py-3 text-[11px] text-zinc-400 tabular">
          <span>
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, instruments.length)} of {instruments.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="rounded-md border border-line bg-zinc-900 px-2.5 py-1 text-paper transition-colors hover:border-zinc-700 hover:bg-zinc-800 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-zinc-500">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="rounded-md border border-line bg-zinc-900 px-2.5 py-1 text-paper transition-colors hover:border-zinc-700 hover:bg-zinc-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
