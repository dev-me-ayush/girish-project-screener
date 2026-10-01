# Client Requirements Specification: Institutional Fibonacci AC / DC Screener

## 1. Executive Summary & Purpose
This application is an institutional-grade, continuous intraday screener developed for **Girish Screener** (equities and F&O derivatives). It tracks real-time market data (via Upstox v2 API), evaluates daily institutional volatility bands, and triggers instant alerts upon price breakouts across multiple timeframes (1m, 2m, 3m, 5m, 15m).

---

## 2. Core Mathematical Specification: AC 38.2% & DC 38.2%

### Terminology
- **PDH**: Previous Day High (completed prior trading session).
- **PDL**: Previous Day Low (completed prior trading session).
- **PDC**: Previous Day Close (completed prior trading session).
- **AC 38.2%**: **Above Close** 38.2% Fibonacci expansion breakout threshold.
- **DC 38.2% (DC 38.2B)**: **Down Close / Below Close** 38.2% Fibonacci expansion breakdown threshold.
- **Average (Pivot)**: Standard typical price $(\text{High} + \text{Low} + \text{Close}) / 3$.

### The Exact Formula
Unlike standard retracements anchored to highs and lows, the client's methodology establishes volatility breakout envelopes anchored directly to **Previous Day Close (PDC)** scaled by the **123.6% Fibonacci expansion ratio ($1.236 = 2 \times 0.618$)**:

1. **Daily Range**:
   $$\text{Range} = \text{PDH} - \text{PDL}$$

2. **Expansion Delta ($\Delta$)**:
   $$\Delta = \text{round}(\text{Range} \times 0.382 \times 1.236, 2) \quad \left[\text{equivalent to } \text{Range} \times 0.472152\right]$$

3. **AC 38.2% (Upper Breakout Threshold)**:
   $$\mathbf{AC\ 38.2} = \text{PDC} + \Delta$$

4. **DC 38.2% (Lower Breakdown Threshold)**:
   $$\mathbf{DC\ 38.2} = \text{PDC} - \Delta$$

5. **Average (Typical Price)**:
   $$\text{Average} = \text{round}\left(\frac{\text{PDH} + \text{PDL} + \text{PDC}}{3}, 2\right)$$

---

## 3. Mathematical Verification & Ground Truth Reference Datasets

### A. 20MICRONS (NSE Session: 2026-09-29)
- **PDH**: `216.45`
- **PDL**: `209.02`
- **PDC**: `212.80`
- **Range**: $216.45 - 209.02 = 7.43$
- **$\Delta$**: $7.43 \times 0.382 \times 1.236 = 3.508089 \xrightarrow{\text{round}} \mathbf{3.51}$
- **AC 38.2%**: $212.80 + 3.51 = \mathbf{216.31}$ *(Matches client expectation to 2 decimal places)*
- **DC 38.2%**: $212.80 - 3.51 = \mathbf{209.29}$ *(Matches client expectation to 2 decimal places)*

### B. BSOFT 1-Month Dataset (`BSOFT DATA 1 MONTH.xlsx`)
Verified 20 out of 20 historical sessions with 100% exact numerical match:
| Sr | Date | High | Low | Close | Range | Average | AC 38.2 | DC 38.2B | $\Delta$ | Match Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 2026-08-31 | 300.85 | 290.00 | 295.80 | 10.85 | 295.55 | 300.92 | 290.68 | 5.12 | Exact 100% |
| 2 | 2026-09-01 | 299.45 | 291.80 | 294.40 | 7.65 | 295.22 | 298.01 | 290.79 | 3.61 | Exact 100% |
| 3 | 2026-09-02 | 297.55 | 290.00 | 293.25 | 7.55 | 293.60 | 296.81 | 289.69 | 3.56 | Exact 100% |
| 4 | 2026-09-03 | 299.55 | 288.45 | 289.35 | 11.10 | 292.45 | 294.59 | 284.11 | 5.24 | Exact 100% |
| 5 | 2026-09-07 | 289.40 | 281.15 | 282.45 | 8.25 | 284.33 | 286.35 | 278.55 | 3.90 | Exact 100% |
| 6 | 2026-09-08 | 283.70 | 280.30 | 281.65 | 3.40 | 281.88 | 283.26 | 280.04 | 1.61 | Exact 100% |
| 7 | 2026-09-09 | 279.85 | 276.10 | 277.20 | 3.75 | 277.72 | 278.97 | 275.43 | 1.77 | Exact 100% |
| 8 | 2026-09-10 | 282.70 | 275.00 | 275.80 | 7.70 | 277.83 | 279.44 | 272.16 | 3.64 | Exact 100% |
| 9 | 2026-09-11 | 284.80 | 274.20 | 281.65 | 10.60 | 280.22 | 286.65 | 276.65 | 5.00 | Exact 100% |
| 10 | 2026-09-15 | 302.85 | 285.10 | 286.45 | 17.75 | 291.47 | 294.83 | 278.07 | 8.38 | Exact 100% |
| 11 | 2026-09-16 | 287.80 | 279.30 | 281.25 | 8.50 | 282.78 | 285.26 | 277.24 | 4.01 | Exact 100% |
| 12 | 2026-09-17 | 286.95 | 281.65 | 283.80 | 5.30 | 284.13 | 286.30 | 281.30 | 2.50 | Exact 100% |
| 13 | 2026-09-18 | 285.05 | 278.45 | 280.40 | 6.60 | 281.30 | 283.52 | 277.28 | 3.12 | Exact 100% |
| 14 | 2026-09-21 | 284.90 | 278.00 | 284.15 | 6.90 | 282.35 | 287.41 | 280.89 | 3.26 | Exact 100% |
| 15 | 2026-09-22 | 284.50 | 280.75 | 281.15 | 3.75 | 282.13 | 282.92 | 279.38 | 1.77 | Exact 100% |
| 16 | 2026-09-23 | 282.80 | 280.00 | 281.10 | 2.80 | 281.30 | 282.42 | 279.78 | 1.32 | Exact 100% |
| 17 | 2026-09-24 | 280.35 | 276.00 | 277.70 | 4.35 | 278.02 | 279.75 | 275.65 | 2.05 | Exact 100% |
| 18 | 2026-09-25 | 278.15 | 273.30 | 274.05 | 4.85 | 275.17 | 276.34 | 271.76 | 2.29 | Exact 100% |
| 19 | 2026-09-28 | 275.90 | 270.00 | 271.25 | 5.90 | 272.38 | 274.04 | 268.46 | 2.79 | Exact 100% |
| 20 | 2026-09-29 | 273.40 | 267.40 | 269.05 | 6.00 | 269.95 | 271.88 | 266.22 | 2.83 | Exact 100% |

---

## 4. Breakout & Evaluation Directives
- **Up Breakout**:
  - Triggers when intraday bar closes $> \text{AC 38.2%}$ or current Last Traded Price (LTP) $> \text{AC 38.2%}$.
  - Label: `Up Breakout` (White text `#ffffff`).
- **Low Breakout**:
  - Triggers when intraday bar closes $< \text{DC 38.2%}$ or current Last Traded Price (LTP) $< \text{DC 38.2%}$.
  - Label: `Low Breakout` (White text `#ffffff`).
- **Inside Range**:
  - Price remains between $\text{DC 38.2%}$ and $\text{AC 38.2%}$.
  - Label: `Inside Range` (Subtle zinc `#a1a1aa`).

---

## 5. UI & Presentation Directives
1. **Monochrome High-Contrast Theme**: Pure black background (`#09090b`), white text (`#ffffff`), zinc hairline borders (`#27272a`).
2. **Strictly Zero Green Colors**: Green colors, neon signals, green glows, and phosphor accents are forbidden.
---

## 6. Multiple Breakout Tracking & Options Integration

### A. Multiple Breakouts in a Single Session
Stocks and options often cross their AC 38.2% or DC 38.2% thresholds multiple times during volatile sessions (e.g. initial 09:35 AM breakout, pullback inside range at 10:15 AM, secondary breakout at 11:20 AM).
- **Scanner Display**:
  - `Status`: Current state (`Up Breakout`, `Low Breakout`, or `Inside Range`).
  - `Breach Count`: Displays breach frequency (e.g. `2x Breakout`).
  - `Time Column`: Displays dual timestamps: `First: 09:35 AM · Latest: 11:20 AM`.
  - `Pullback State`: If a previously broken stock pulls back into range, status reflects `Inside Range` with a reference indicator `(Prior 5m Break: 09:35 AM)`.
- **Alert Logging**:
  - A new alert record is created **only on fresh crossover transitions** (entering a breach from inside range, or flipping from AC to DC).
  - Continuous bars holding above AC 38.2% do not spam duplicate database rows.

### B. High-Liquidity Index Options Integration
- **Universe**: Automatically discovers nearest weekly expiry for **NIFTY 50** (ATM ± 7 strikes = 30 contracts) and **BANK NIFTY** (ATM ± 5 strikes = 22 contracts).
- **Batch Processing**: 2,680 equities + 52 options = 2,732 instruments. Handled within the **exact same 6-batch Upstox quote cycle** ($2,732 / 500 = 6$ HTTP calls every 1 minute). Consumes only 1.2% of Upstox 500 req/min rate limit and 9% of 30-minute limit.
- **Tabs Filter**: One-click toggles for `[All (2,732)]`, `[Equities (2,680)]`, `[Options (52)]`, `[Up Breakouts]`, `[Low Breakouts]`, and `[★ My Watchlist]`.
