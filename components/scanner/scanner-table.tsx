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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 font-mono shadow-sm">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60 text-[11px] text-zinc-400">
              <th className="w-10 px-3 py-3 text-center">Pin</th>
              <th className="w-12 px-3 py-3">#</th>
              <th className="px-3 py-3">Symbol</th>
              <th className="px-3 py-3 text-right">5m LTP</th>
              <th className="px-3 py-3 text-right">Day Chg</th>
              <th className="px-3 py-3 text-right">PDH</th>
              <th className="px-3 py-3 text-right">PDL</th>
              <th className="px-3 py-3 text-right">PDC</th>
              <th className="px-3 py-3 text-right">AC 38.2%</th>
              <th className="px-3 py-3 text-right">DC 38.2%</th>
              <th className="px-3 py-3">5m Status</th>
              <th className="px-3 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
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
                <td colSpan={12} className="py-12 text-center text-xs text-zinc-500">
                  No matching instruments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
          <span>
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, instruments.length)} of {instruments.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-white hover:border-zinc-600 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="text-zinc-500">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-white hover:border-zinc-600 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
