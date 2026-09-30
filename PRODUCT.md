# Tessera — Institutional Screener & Fibonacci Terminal

## Purpose & Positioning
Tessera is a high-speed, institutional-grade equities and derivatives screener and technical analysis platform designed for serious Indian stock market (NSE) traders. It delivers sub-second Fibonacci breakout detection (AC/DC 38.2% levels across multiple timeframes), curated watchlist monitoring, and real-time benchmark index streaming via Upstox Market Gateway and Neon Serverless Postgres.

## Core Workflows
1. **Benchmark Overview**: Live real-time market surveillance across flagship indices (NIFTY 50, NIFTY BANK, SENSEX, NIFTY FINANCIAL SERVICES) with minute-boundary auto-synchronization and complete OHLC metrics.
2. **Curated Watchlists**: Custom user-defined watchlists for equities and options contracts with live LTP, Open Interest (OI), Volume, and execution metrics.
3. **Watchlist Screener**: Multi-watchlist continuous scanner pinpointing institutional Fibonacci 38.2% Ascending & Descending cycle breakout candidates in real time.
4. **Fibonacci Levels Terminal**: 5-timeframe multi-resolution Fibonacci retracement and breakout analyzer across 2,680+ active NSE equities.

## Stack & Architecture
- **Framework**: Next.js 15 (App Router, Server Components & Client Terminals)
- **Primary Database**: Neon Serverless Postgres (`@neondatabase/serverless`)
- **Market Data Gateway**: Upstox Market API v2
- **Deployment**: AWS App Runner (Containerized Standalone, `ap-south-1`)
