import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getOISignal, annotateOISignals } from "../lib/options-signals.ts";

describe("Options directional signals (BULLISH / BEARISH)", () => {
  test("positive inflection (negative -> positive) fires BULLISH", () => {
    assert.equal(getOISignal(163475, -859560), "BULLISH");
  });

  test("positive inflection from flat fires BULLISH", () => {
    assert.equal(getOISignal(500, 0), "BULLISH");
  });

  test("negative inflection (positive -> negative) fires BEARISH", () => {
    assert.equal(getOISignal(-690235, 163475), "BEARISH");
  });

  test("negative inflection from flat fires BEARISH", () => {
    assert.equal(getOISignal(-100, 0), "BEARISH");
  });

  test("momentum continuation fires no signal", () => {
    assert.equal(getOISignal(200, 150), null);
    assert.equal(getOISignal(-200, -150), null);
  });

  test("flat row fires no signal", () => {
    assert.equal(getOISignal(0, 0), null);
    assert.equal(getOISignal(0, 120), null);
  });

  test("annotateOISignals marks both inflections newest-first", () => {
    // Newest-first differences: 100 -> 50 -> 80 -> 70
    // changeDiffs: +50 (vs older +30? no: older delta = 50-80 = -30 <= 0 => BULLISH),
    //             -30 (older delta = 80-70 = +10 >= 0 => BEARISH), +10 (oldest-1, older=0 => BULLISH)
    const rows = annotateOISignals([
      { difference: 100 },
      { difference: 50 },
      { difference: 80 },
      { difference: 70 },
    ]);
    assert.equal(rows[0].changeDiff, 50);
    assert.equal(rows[0].signal, "BULLISH");
    assert.equal(rows[0].revSignal, true);
    assert.equal(rows[1].changeDiff, -30);
    assert.equal(rows[1].signal, "BEARISH");
    assert.equal(rows[1].revSignal, true);
    assert.equal(rows[2].changeDiff, 10);
    assert.equal(rows[2].signal, "BULLISH");
    assert.equal(rows[3].changeDiff, 0);
    assert.equal(rows[3].signal, null);
    assert.equal(rows[3].revSignal, false);
  });

  test("annotateOISignals leaves continuation rows unmarked", () => {
    const rows = annotateOISignals([
      { difference: 500 },
      { difference: 400 },
      { difference: 300 },
      { difference: 200 },
      { difference: 100 },
    ]);
    // Mid-series continuation rows: positive delta preceded by positive delta.
    for (const r of rows.slice(0, 3)) {
      assert.ok(r.changeDiff > 0);
      assert.equal(r.signal, null);
      assert.equal(r.revSignal, false);
    }
    // Edge: the row before the oldest has no older delta (0), so a positive
    // move there reads as an inflection from flat.
    assert.equal(rows[3].signal, "BULLISH");
    assert.equal(rows[4].signal, null);
  });

  test("annotateOISignals on empty and single-row inputs", () => {
    assert.deepEqual(annotateOISignals([]), []);
    const single = annotateOISignals([{ difference: 42 }]);
    assert.equal(single[0].changeDiff, 0);
    assert.equal(single[0].signal, null);
    assert.equal(single[0].revSignal, false);
  });
});

describe("Options signal export labels", () => {
  const rows = [
    {
      time: "14:15",
      strikes: [{ strike: 22300, callOIChange: 1, putOIChange: 2 }],
      totalCallOIChange: 1,
      totalPutOIChange: 2,
      difference: 1,
      changeDiff: 100,
      signal: "BULLISH",
      revSignal: true,
    },
    {
      time: "14:12",
      strikes: [{ strike: 22300, callOIChange: 3, putOIChange: 4 }],
      totalCallOIChange: 3,
      totalPutOIChange: 4,
      difference: -1,
      changeDiff: -100,
      signal: "BEARISH",
      revSignal: true,
    },
    {
      time: "14:09",
      strikes: [{ strike: 22300, callOIChange: 5, putOIChange: 6 }],
      totalCallOIChange: 5,
      totalPutOIChange: 6,
      difference: 0,
      changeDiff: 50,
      signal: null,
      revSignal: false,
    },
    // Legacy row without a signal field: revSignal maps to BULLISH.
    {
      time: "14:06",
      strikes: [{ strike: 22300, callOIChange: 7, putOIChange: 8 }],
      totalCallOIChange: 7,
      totalPutOIChange: 8,
      difference: 2,
      changeDiff: 60,
      revSignal: true,
    },
  ];
  const meta = {
    indexName: "NIFTY 50",
    expiry: "2026-10-13",
    intervalMinutes: 3,
    activeStrikes: [22300],
  };

  test("CSV emits BULLISH / BEARISH / - and no REVERSAL", async () => {
    const { generateHistoryCSV } = await import("../lib/options-export.ts");
    const csv = generateHistoryCSV(rows, meta);
    assert.ok(csv.includes(",BULLISH"), "CSV must contain BULLISH label");
    assert.ok(csv.includes(",BEARISH"), "CSV must contain BEARISH label");
    assert.ok(!csv.includes("REVERSAL"), "CSV must not contain legacy REVERSAL label");
    assert.ok(csv.includes("Signal"), "CSV header must be renamed to Signal");
  });

  test("Excel signal cells carry directional text with green/red fonts", async () => {
    const { createHistoryExcelWorkbook } = await import("../lib/options-export.ts");
    const wb = await createHistoryExcelWorkbook(rows, meta);
    const ws = wb.getWorksheet("OI Analysis");
    assert.ok(ws, "Worksheet 'OI Analysis' must exist");
    assert.equal(ws.getCell("L4").value, "Signal");

    const bullishCell = ws.getRow(6).getCell(12);
    assert.equal(bullishCell.value, "BULLISH");
    assert.equal(bullishCell.font?.color?.argb, "FF059669");

    const bearishCell = ws.getRow(7).getCell(12);
    assert.equal(bearishCell.value, "BEARISH");
    assert.equal(bearishCell.font?.color?.argb, "FFE11D48");

    const neutralCell = ws.getRow(8).getCell(12);
    assert.equal(neutralCell.value, "-");

    const legacyCell = ws.getRow(9).getCell(12);
    assert.equal(legacyCell.value, "BULLISH");
  });
});
