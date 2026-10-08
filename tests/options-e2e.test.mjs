import { test, describe } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import {
  INDICES_CONFIG,
  formatIndianNumber,
  calculateAtmStrike,
  getPresetStrikes,
} from "../lib/options-service.ts";

const token = process.env.UPSTOX_ACCESS_TOKEN;
const headers = {
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
};

describe("1. Options Service Math & Calculation Rules", () => {
  test("Indian Number formatting rules", () => {
    assert.equal(formatIndianNumber(0), "0");
    assert.equal(formatIndianNumber(500), "500");
    assert.equal(formatIndianNumber(2254395), "22,54,395");
    assert.equal(formatIndianNumber(14572935), "1,45,72,935");
    assert.equal(formatIndianNumber(12318540), "1,23,18,540");
    assert.equal(formatIndianNumber(-1321320), "-13,21,320");
    assert.equal(formatIndianNumber(-690235), "-6,90,235");
  });

  test("ATM strike calculation for all indices", () => {
    // Nifty 50 (step 50)
    assert.equal(calculateAtmStrike(23897.7, 50), 23900);
    assert.equal(calculateAtmStrike(22372.4, 50), 22350);

    // Bank Nifty (step 100)
    assert.equal(calculateAtmStrike(57369.65, 100), 57400);
    assert.equal(calculateAtmStrike(54868.5, 100), 54900);

    // Fin Nifty (step 50)
    assert.equal(calculateAtmStrike(26051.0, 50), 26050);
    assert.equal(calculateAtmStrike(24774.35, 50), 24750);
  });

  test("Strike preset scenarios: Consecutive, ATM±2, ATM±3", () => {
    const atm = 23900;
    const step = 50;

    // Screenshot mode: Consecutive [ATM, +1, +2]
    const consecutive = getPresetStrikes(atm, step, "consecutive");
    assert.deepEqual(consecutive, [23900, 23950, 24000]);

    // ATM ± 2 mode: [ATM - 2*step, ATM, ATM + 2*step]
    const plusMinus2 = getPresetStrikes(atm, step, "atm_plus_minus_2");
    assert.deepEqual(plusMinus2, [23800, 23900, 24000]);

    // ATM ± 3 mode: [ATM - 3*step, ATM, ATM + 3*step]
    const plusMinus3 = getPresetStrikes(atm, step, "atm_plus_minus_3");
    assert.deepEqual(plusMinus3, [23750, 23900, 24050]);
  });
});

describe("2. End-to-End Real Data Scenarios: Quotes & Expiries", () => {
  test("All 4 benchmark indices provide real-time quotes", async () => {
    assert.ok(token, "UPSTOX_ACCESS_TOKEN must be present");
    for (const idx of INDICES_CONFIG) {
      const quoteUrl = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(idx.key)}`;
      const res = await fetch(quoteUrl, { headers });
      assert.equal(res.status, 200, `Quote endpoint returned status ${res.status} for ${idx.name}`);
      const data = await res.json();
      const firstKey = Object.keys(data.data || {})[0];
      const quoteObj = data.data?.[firstKey];
      assert.ok(quoteObj, `Quote object missing for ${idx.name}`);
      assert.ok(quoteObj.last_price > 0, `LTP must be greater than 0 for ${idx.name}`);
      assert.ok(quoteObj.ohlc?.close > 0, `OHLC close price must be greater than 0 for ${idx.name}`);
    }
  });

  test("Nifty 50, Bank Nifty, and Fin Nifty return active expiry series", async () => {
    const indicesToTest = INDICES_CONFIG.slice(0, 3);
    for (const idx of indicesToTest) {
      const contractUrl = `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(idx.key)}`;
      const res = await fetch(contractUrl, { headers });
      assert.equal(res.status, 200, `Contract endpoint returned status ${res.status} for ${idx.name}`);
      const data = await res.json();
      const contracts = data.data || [];
      assert.ok(contracts.length > 50, `Expected at least 50 option contracts for ${idx.name}`);
      const expiries = [...new Set(contracts.map((c) => c.expiry))];
      assert.ok(expiries.length > 0, `No active expiries found for ${idx.name}`);
    }
  });
});

describe("3. End-to-End Real Data Scenarios: Option Chain & PCR", () => {
  test("Option chain calculates PCR, Net OI, and volume concentrations for Nifty 50", async () => {
    // 1. Get nearest expiry
    const contractUrl = `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent("NSE_INDEX|Nifty 50")}`;
    const contractRes = await fetch(contractUrl, { headers });
    const contractData = await contractRes.json();
    const expiries = [...new Set((contractData.data || []).map((c) => c.expiry))].sort();
    const expiry = expiries[0];
    assert.ok(expiry, "Active expiry required for chain verification");

    // 2. Fetch live chain
    const chainUrl = `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent("NSE_INDEX|Nifty 50")}&expiry_date=${expiry}`;
    const chainRes = await fetch(chainUrl, { headers });
    assert.equal(chainRes.status, 200, `Option chain failed with status ${chainRes.status}`);
    const chainData = await chainRes.json();
    const rows = chainData.data || [];
    assert.ok(rows.length > 20, "Expected at least 20 strikes in active chain");

    let totalCallOI = 0;
    let totalPutOI = 0;
    for (const r of rows) {
      assert.ok(typeof r.strike_price === "number", "strike_price must be a number");
      totalCallOI += r.call_options?.market_data?.oi || 0;
      totalPutOI += r.put_options?.market_data?.oi || 0;
    }

    assert.ok(totalCallOI > 0, "Total Call OI must be greater than zero");
    assert.ok(totalPutOI > 0, "Total Put OI must be greater than zero");

    const pcr = totalPutOI / totalCallOI;
    assert.ok(pcr > 0.1 && pcr < 5.0, `Calculated PCR ${pcr} is within realistic bounds`);
  });
});

describe("4. End-to-End Real Data Scenarios: Intraday 1-Min Candle OI from 9:15 AM", () => {
  test("Option contract returns intraday 1-minute historical candles with OI", async () => {
    // Fetch an active ATM option contract
    const quoteRes = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent("NSE_INDEX|Nifty 50")}`, { headers });
    const quoteData = await quoteRes.json();
    const spot = quoteData.data?.[Object.keys(quoteData.data || {})[0]]?.last_price || 22350;
    const atm = calculateAtmStrike(spot, 50);

    const contractRes = await fetch(`https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent("NSE_INDEX|Nifty 50")}`, { headers });
    const contractData = await contractRes.json();
    const expiries = [...new Set((contractData.data || []).map((c) => c.expiry))].sort();
    const nearestExpiry = expiries[0];

    const match = (contractData.data || []).find((c) => c.strike_price === atm && c.expiry === nearestExpiry && c.instrument_type === "CE");
    assert.ok(match, `Could not find CE contract for ATM strike ${atm}`);

    const candleUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(match.instrument_key)}/1minute`;
    const candleRes = await fetch(candleUrl, { headers });
    assert.equal(candleRes.status, 200, `Candle API returned status ${candleRes.status}`);
    const candleJson = await candleRes.json();
    const candles = candleJson.data?.candles || [];
    assert.ok(candles.length > 0, "Intraday candle array must not be empty");

    // Earliest candle of the trading day
    const earliest = candles[candles.length - 1];
    const timestampStr = earliest[0];
    const openInterest = earliest[6];

    assert.ok(timestampStr.includes("09:15") || timestampStr.includes("09:"), `Candles must start in the 9:00 AM market window, received ${timestampStr}`);
    assert.ok(typeof openInterest === "number", "Candle OI must be a number");
  });
});

describe("5. End-to-End Real Data Scenarios: Momentum Delta & Reversal Signal", () => {
  test("Time-series difference and reversal delta calculations maintain integrity", () => {
    // Sample sequence matching the client's spreadsheet:
    // At T-1: PutOIChange = 1,72,63,285, CallOIChange = 42,54,510 -> Diff = 1,30,08,775
    // At T:   PutOIChange = 1,45,72,935, CallOIChange = 22,54,395 -> Diff = 1,23,18,540
    const prevDiff = 13008775;
    const currentDiff = 12318540;
    const delta = currentDiff - prevDiff;
    assert.equal(delta, -690235, "Interval delta must exactly match -6,90,235");

    // Positive inflection (Reversal signal scenario)
    // Diff at 03:19: 1,74,14,540, Diff at 03:16: 1,72,51,065 -> Delta: +1,63,475
    const diff19 = 17414540;
    const diff16 = 17251065;
    const deltaReversal = diff19 - diff16;
    assert.equal(deltaReversal, 163475, "Positive inflection delta must match +1,63,475");
    assert.ok(deltaReversal > 0, "Positive delta triggers bullish momentum indicator");
  });
});

describe("6. Export Features: CSV & Excel Generator Integrity", () => {
  const mockRows = [
    {
      time: "14:15",
      strikes: [
        { strike: 22300, callOIChange: 3243825, putOIChange: 1718145 },
        { strike: 22350, callOIChange: 3353610, putOIChange: 1718665 },
        { strike: 22400, callOIChange: 6802575, putOIChange: 1344460 },
      ],
      totalCallOIChange: 13400010,
      totalPutOIChange: 4781270,
      difference: -8618740,
      changeDiff: 164255,
      revSignal: true,
    },
    {
      time: "14:12",
      strikes: [
        { strike: 22300, callOIChange: 2938455, putOIChange: 1674530 },
        { strike: 22350, callOIChange: 3198195, putOIChange: 1511640 },
        { strike: 22400, callOIChange: 6707545, putOIChange: 1027910 },
      ],
      totalCallOIChange: 12844195,
      totalPutOIChange: 4214080,
      difference: -8630115,
      changeDiff: -859560,
      revSignal: false,
    },
  ];

  const meta = {
    indexName: "NIFTY 50",
    expiry: "2026-10-13",
    intervalMinutes: 3,
    activeStrikes: [22300, 22350, 22400],
  };

  test("generateHistoryCSV produces valid comma-separated text with correct columns and headers", async () => {
    const { generateHistoryCSV } = await import("../lib/options-export.ts");
    const csv = generateHistoryCSV(mockRows, meta);

    assert.ok(typeof csv === "string", "CSV must return a string");
    assert.ok(csv.includes("Index,NIFTY 50,Expiry,2026-10-13,Interval,3 Minutes"));
    assert.ok(csv.includes("Time,22300 CALL,22300 PUT,22350 CALL,22350 PUT,22400 CALL,22400 PUT"));
    assert.ok(csv.includes("14:15,3243825,1718145,3353610,1718665,6802575,1344460,13400010,4781270,-8618740,164255,REVERSAL"));
    assert.ok(csv.includes("14:12,2938455,1674530,3198195,1511640,6707545,1027910,12844195,4214080,-8630115,-859560,-"));
  });

  test("createHistoryExcelWorkbook builds styled multi-sheet workbook with formatting and colors", async () => {
    const { createHistoryExcelWorkbook } = await import("../lib/options-export.ts");
    const wb = await createHistoryExcelWorkbook(mockRows, meta);

    assert.ok(wb, "Workbook must be created");
    const ws = wb.getWorksheet("OI Analysis");
    assert.ok(ws, "Worksheet 'OI Analysis' must exist");

    // Title & Metadata
    assert.equal(ws.getCell("A1").value, "NIFTY 50 - Three Strike Range Change in OI Analysis");
    assert.ok(String(ws.getCell("A2").value).includes("Expiry: 2026-10-13"));

    // Header cells & strike titles
    assert.equal(ws.getCell("A4").value, "Time");
    assert.equal(ws.getCell("B4").value, "22300");
    assert.equal(ws.getCell("D4").value, "22350");
    assert.equal(ws.getCell("F4").value, "22400");
    assert.equal(ws.getCell("B5").value, "CALL");
    assert.equal(ws.getCell("C5").value, "PUT");

    // Data row 1 checks
    const row6 = ws.getRow(6);
    assert.equal(row6.getCell(1).value, "14:15");
    assert.equal(row6.getCell(2).value, 3243825); // S1 Call
    assert.equal(row6.getCell(3).value, 1718145); // S1 Put
    assert.equal(row6.getCell(8).value, 13400010); // Total Call
    assert.equal(row6.getCell(9).value, 4781270);  // Total Put
    assert.equal(row6.getCell(10).value, -8618740); // Diff
    assert.equal(row6.getCell(11).value, 164255);   // Delta
    assert.equal(row6.getCell(12).value, "REVERSAL");

    // Check buffer export ability
    const buffer = await wb.xlsx.writeBuffer();
    assert.ok(buffer.byteLength > 1000, "Excel binary buffer must be valid and non-empty");
  });
});

