# 4tlas

**Real-time global intelligence dashboard** — AI-powered news aggregation, geopolitical monitoring, and infrastructure tracking in a unified situational awareness interface.

[![GitHub stars](https://img.shields.io/github/stars/suzarilshah/4tlas?style=social)](https://github.com/suzarilshah/4tlas/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/suzarilshah/4tlas?style=social)](https://github.com/suzarilshah/4tlas/network/members)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Last commit](https://img.shields.io/github/last-commit/suzarilshah/4tlas)](https://github.com/suzarilshah/4tlas/commits/main)

<p align="center">
  <a href="https://4tlas.pages.dev"><img src="https://img.shields.io/badge/Web_App-4tlas.pages.dev-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Web App"></a>
</p>

<p align="center">
  <a href="./docs/DOCUMENTATION.md"><strong>Full Documentation</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/suzarilshah/4tlas/releases"><strong>All Releases</strong></a>
</p>

![4tlas Dashboard](docs/images/worldmonitor-7-mar-2026.jpg)

---

## Why 4tlas?

| Problem                            | Solution                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| News scattered across 100+ sources | **Single unified dashboard** with 435+ curated feeds across 15 categories                                  |
| No geospatial context for events   | **Interactive map** with 45 toggleable data layers and CII country risk heatmap                             |
| Information overload               | **AI-synthesized briefs** with focal point detection and local LLM support                                 |
| Crypto/macro signal noise          | **7-signal market radar** with composite BUY/CASH verdict                                                  |
| Expensive OSINT tools ($$$)        | **100% free & open source**                                                                                |
| Static news feeds                  | **Real-time updates** with live video streams and AI-powered deductions                                    |
| Cloud-dependent AI tools           | **Run AI locally** with Ollama/LM Studio — no API keys, no data leaves your machine. Opt-in **Headline Memory** builds a local semantic index of every headline for RAG-powered queries |
| Web-only dashboards                | **Native desktop app** (Tauri) for macOS, Windows, and Linux + installable PWA with offline map support    |
| Flat 2D maps                       | **Dual map engine** — photorealistic 3D globe (globe.gl + Three.js) and WebGL flat map (deck.gl) with 45 toggleable data layers, runtime-switchable |
| English-only OSINT tools           | **21 languages** with native-language RSS feeds, AI-translated summaries, and RTL support for Arabic       |
| Siloed financial data              | **Finance variant** with 92 stock exchanges, 19 financial centers, 13 central banks, BIS data, WTO trade policy, and Gulf FDI tracking |
| Undocumented, fragile APIs         | **Proto-first API contracts** — 22 typed services with auto-generated clients, servers, and OpenAPI docs   |

---

## Live Demo

| Variant             | URL                                                          | Focus                                            |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| **4tlas**           | [4tlas.pages.dev](https://4tlas.pages.dev)                   | Geopolitics, military, conflicts, infrastructure |

The codebase supports multiple variants (Tech, Finance, Commodity, Happy) — switch between them via the header bar or build with different `VITE_VARIANT` values.

---

## Key Features

### Maps & Visualization

- **Dual Map Engine** — 3D globe (globe.gl + Three.js) and WebGL flat map (deck.gl), runtime-switchable with 45 shared data layers. [Details →](./docs/MAP_ENGINE.md)
- **45 toggleable data layers** — conflicts, bases, cables, pipelines, flights, vessels, protests, fires, earthquakes, datacenters, and more across all variants
- **8 regional presets** — Global, Americas, Europe, MENA, Asia, Africa, Oceania, Latin America with time filtering (1h–7d)
- **CII choropleth heatmap** — five-stop color gradient paints every country by instability score on both map engines
- **URL state sharing** — map center, zoom, active layers, and time range encoded in shareable URLs

### AI & Intelligence

- **World Brief** — LLM-synthesized summary with 4-tier fallback: Ollama (local) → Groq → OpenRouter → browser T5. [Details →](./docs/AI_INTELLIGENCE.md)
- **AI Deduction & Forecasting** — free-text geopolitical analysis grounded in live headlines. [Details →](./docs/AI_INTELLIGENCE.md#ai-deduction--forecasting)
- **Headline Memory (RAG)** — opt-in browser-local semantic index using ONNX embeddings in IndexedDB. [Details →](./docs/AI_INTELLIGENCE.md#client-side-headline-memory-rag)
- **Threat Classification** — instant keyword classifier with async ML and LLM override. [Details →](./docs/AI_INTELLIGENCE.md#threat-classification-pipeline)
- **Country Brief Pages** — full-page intelligence dossiers with CII scores, AI analysis, timelines, and prediction markets. [Details →](./docs/AI_INTELLIGENCE.md#country-brief-pages)

### Data Layers

<details>
<summary><strong>Geopolitical</strong> — conflicts, hotspots, protests, disasters, sanctions, cyber IOCs, GPS jamming, Iran events</summary>

[Full details →](./docs/DATA_SOURCES.md#data-layers)
</details>

<details>
<summary><strong>Military & Strategic</strong> — 210+ bases, live flights (ADS-B), naval vessels (AIS), nuclear facilities, spaceports</summary>

[Full details →](./docs/DATA_SOURCES.md#data-layers)
</details>

<details>
<summary><strong>Infrastructure</strong> — undersea cables, pipelines, 111 AI datacenters, 83 strategic ports, 107 airports, trade routes</summary>

[Full details →](./docs/DATA_SOURCES.md#data-layers)
</details>

<details>
<summary><strong>Market & Crypto</strong> — 7-signal macro radar, market watchlist, Gulf economies, crypto, prediction markets, stablecoins, ETF flows</summary>

[Full details →](./docs/DATA_SOURCES.md#data-layers)
</details>

<details>
<summary><strong>Tech Ecosystem</strong> — company HQs, startup hubs, cloud regions, accelerators, conferences</summary>

[Full details →](./docs/DATA_SOURCES.md#data-layers)
</details>

<details>
<summary><strong>Finance & Markets</strong> — 92 stock exchanges, 19 financial centers, 13 central banks, BIS data, WTO trade policy, Gulf FDI</summary>

[Full details →](./docs/FINANCE_DATA.md)
</details>

### Live News & Video

- **435+ RSS feeds** across geopolitics, defense, energy, tech, and finance with server-side aggregation (95% fewer edge invocations). [Details →](./docs/DATA_SOURCES.md#server-side-aggregation)
- **30+ live video streams** — Bloomberg, Sky News, Al Jazeera, and more with HLS native streaming, idle-aware playback, and fullscreen mode
- **22 live webcams** — geopolitical hotspot streams across 5 regions with Iran/Attacks dedicated tab
- **Custom keyword monitors** — user-defined alerts with word-boundary matching and auto-coloring

### Scoring & Detection

- **Country Instability Index (CII)** — real-time stability scores using weighted multi-signal blend across 23 tier-1 nations + universal scoring for all countries. [Details →](./docs/ALGORITHMS.md#country-instability-index-cii)
- **Hotspot Escalation** — dynamic scoring blending news activity, CII, geo-convergence, and military signals. [Details →](./docs/ALGORITHMS.md#hotspot-escalation-scoring)
- **Strategic Risk Score** — composite geopolitical risk from convergence, CII, infrastructure, theater, and breaking news. [Details →](./docs/ALGORITHMS.md#strategic-risk-score-algorithm)
- **Signal Aggregation** — multi-source fusion with temporal baseline anomaly detection (Welford's algorithm). [Details →](./docs/ALGORITHMS.md#signal-aggregation)
- **Cross-Stream Correlation** — 14 signal types detecting patterns across news, markets, military, and predictions. [Details →](./docs/ALGORITHMS.md#cross-stream-correlation-engine)

### Finance & Markets

- **Macro Signal Analysis** — 7-signal market radar with composite BUY/CASH verdict. [Details →](./docs/FINANCE_DATA.md#macro-signal-analysis-market-radar)
- **Gulf FDI** — 64 Saudi/UAE investments plotted globally. [Details →](./docs/FINANCE_DATA.md#gulf-fdi-investment-database)
- **Stablecoin & BTC ETF** — peg health monitoring and spot ETF flow tracking. [Details →](./docs/FINANCE_DATA.md)
- **Oil & Energy** — WTI/Brent prices, production, inventory via EIA. [Details →](./docs/FINANCE_DATA.md#oil--energy-analytics)
- **BIS & WTO** — central bank rates, trade policy intelligence. [Details →](./docs/FINANCE_DATA.md)

### Desktop & Mobile

- **Native desktop app** (Tauri) — macOS, Windows, Linux with OS keychain, local sidecar, and cloud fallback. [Details →](./docs/DESKTOP_APP.md)
- **Progressive Web App** — installable with offline map support (CacheFirst tiles, 500-tile cap)
- **Mobile-optimized map** — touch pan with inertia, pinch-to-zoom, bottom-sheet popups, GPS centering
- **Responsive layout** — ultra-wide L-shaped layout on 2000px+, collapsible panels, mobile search sheet

### Platform Features

- **21 languages** — lazy-loaded bundles with native-language RSS feeds, AI translation, and RTL support
- **Cmd+K command palette** — fuzzy search across 24 result types, layer presets, ~250 country commands
- **Proto-first API contracts** — 92 proto files, 22 services, auto-generated TypeScript + OpenAPI docs
- **Dark/light theme** — persistent toggle with 20+ semantic color variables
- **Story sharing** — intelligence briefs exportable to Twitter/X, LinkedIn, WhatsApp, Telegram, Reddit with OG images

---

## How It Works

### AI & Analysis Pipeline

**AI Summarization** — 4-tier provider chain (Ollama → Groq → OpenRouter → browser T5) with headline deduplication, variant-aware prompting, and Redis caching (24h TTL). [Details →](./docs/AI_INTELLIGENCE.md#ai-summarization-chain)

**AI Deduction** — interactive geopolitical forecasting grounded in 15 most recent headlines, cached 1 hour by query hash. [Details →](./docs/AI_INTELLIGENCE.md#ai-deduction--forecasting)

**Headline Memory** — opt-in ONNX-powered RAG system storing 5,000 headline vectors in IndexedDB for semantic search. [Details →](./docs/AI_INTELLIGENCE.md#client-side-headline-memory-rag)

**Threat Classification** — three-stage pipeline: instant keyword → browser ML → batched LLM, each improving confidence. [Details →](./docs/AI_INTELLIGENCE.md#threat-classification-pipeline)

**Browser-Side ML** — Transformers.js runs NER, sentiment, and embeddings entirely in the browser via Web Workers. [Details →](./docs/AI_INTELLIGENCE.md#browser-side-ml-pipeline)

### Scoring Algorithms

**Country Instability Index** — 0–100 score from baseline risk (40%), unrest (20%), security (20%), and information velocity (20%), with conflict-zone floors and travel advisory boosts. [Details →](./docs/ALGORITHMS.md#country-instability-index-cii)

**Hotspot Escalation** — blends news (35%), CII (25%), geo-convergence (25%), and military (15%) with 48-hour trend regression. [Details →](./docs/ALGORITHMS.md#hotspot-escalation-scoring)

**Strategic Theater Posture** — 9 operational theaters assessed for NORMAL → ELEVATED → CRITICAL based on aircraft, strike capability, naval presence, and regional CII. [Details →](./docs/ALGORITHMS.md#strategic-theater-posture-assessment)

**Geographic Convergence** — 1°×1° spatial binning detects 3+ event types co-occurring within 24 hours. [Details →](./docs/ALGORITHMS.md#geographic-convergence-detection)

**Trending Keywords** — 2-hour rolling window vs 7-day baseline flags surging terms with CVE/APT extraction. [Details →](./docs/ALGORITHMS.md#trending-keyword-spike-detection)

### Data Collection

**435+ RSS feeds** with 4-tier source credibility, server-side aggregation, and per-feed circuit breakers. [Details →](./docs/DATA_SOURCES.md)

**Military tracking** — ADS-B flights, AIS vessels, USNI fleet reports, Wingbits aircraft enrichment. [Details →](./docs/DATA_SOURCES.md#intelligence-feeds)

**Telegram OSINT** — 26 channels via MTProto with dedup and topic classification. [Details →](./docs/DATA_SOURCES.md#telegram-osint-intelligence-feed)

**OREF rocket alerts** — Israel Home Front Command sirens via residential proxy. [Details →](./docs/DATA_SOURCES.md#oref-rocket-alert-integration)

**Prediction markets** — Polymarket contracts with 4-tier fetch and country matching. [Details →](./docs/DATA_SOURCES.md#prediction-markets)

### Architecture Overview

**Vanilla TypeScript** — no framework, direct DOM manipulation, custom Panel/VirtualList classes. The entire app shell weighs less than React's runtime. [Details →](./docs/ARCHITECTURE.md)

**Cloudflare Workers API** — single Worker handles all API endpoints with KV caching, deployed to the edge globally.

**Cloudflare Pages** — frontend deployed to Pages with automatic preview deployments for PRs.

**Heroku Relay** — WebSocket relay for AIS vessel tracking, OpenSky flights, Telegram OSINT, and OREF alerts.

**3-tier caching** — in-memory → KV/Redis → upstream with cache stampede prevention and stale-on-error fallback.

**SmartPollLoop** — adaptive refresh with exponential backoff, hidden-tab throttle, and circuit breaker integration.

---

## Multi-Variant Architecture

A single codebase produces multiple specialized dashboards, each with distinct feeds, panels, map layers, and branding:

| Aspect                | 4tlas                                                | Tech Variant                                    | Finance Variant                                  |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| **Focus**             | Geopolitics, military, conflicts                     | AI/ML, startups, cybersecurity                  | Markets, trading, central banks                  |
| **RSS Feeds**         | 15 categories, 200+ feeds (politics, MENA, Africa, think tanks) | 21 categories, 152 feeds (AI, VC blogs, startups, GitHub) | 14 categories, 55 feeds (forex, bonds, commodities, IPOs) |
| **Panels**            | 45 (strategic posture, CII, cascade, trade policy, airline intel, predictions) | 28 (AI labs, unicorns, accelerators, tech readiness) | 27 (forex, bonds, derivatives, trade policy, gulf economies) |
| **Unique Map Layers** | Military bases, nuclear facilities, hotspots         | Tech HQs, cloud regions, startup hubs           | Stock exchanges, central banks, Gulf investments |
| **Desktop App**       | 4tlas.app / .exe / .AppImage                         | 4tlas-tech.app / .exe / .AppImage               | 4tlas-finance.app / .exe / .AppImage             |

Build-time `VITE_VARIANT` tree-shakes unused data. Runtime variant selector in the header bar.

---

## Programmatic API Access

The API is served via Cloudflare Workers at `4tlas-api.worldmonitor.workers.dev`:

```bash
# Bootstrap data (news, markets, alerts)
curl -s 'https://4tlas-api.worldmonitor.workers.dev/api/bootstrap'

# Get earthquake data
curl -s 'https://4tlas-api.worldmonitor.workers.dev/api/seismology/v1/list-earthquakes'
```

Responses include `X-Cache` headers (`HIT`, `MISS`) for cache debugging and `Cache-Control` headers for CDN integration.

---

## Security Model

| Layer                          | Mechanism                                                                                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CORS origin allowlist**      | Only `4tlas.pages.dev`, `*.pages.dev` preview deployments, and `localhost:*` can call API endpoints. All others receive 403. Implemented in `workers/index.ts`.                                                                                    |
| **RSS domain allowlist**       | The RSS proxy only fetches from explicitly listed domains (~90+). Requests for unlisted domains are rejected with 403.                                                                                                                             |
| **Heroku relay allowlist**     | The Heroku relay has a separate domain allowlist for feeds that need the alternate origin.                                                                                                                                                         |
| **API key isolation**          | All API keys live server-side in environment variables (Cloudflare or Vercel). The browser never sees Groq, OpenRouter, ACLED, Finnhub, or other credentials.                                                                                      |
| **Input sanitization**         | User-facing content passes through `escapeHtml()` (prevents XSS) and `sanitizeUrl()` (blocks `javascript:` and `data:` URIs). URLs use `escapeAttr()` for attribute context encoding.                                                              |
| **Query parameter validation** | API endpoints validate input formats (e.g., stablecoin coin IDs must match `[a-z0-9-]+`, bounding box params are numeric).                                                                                                                         |
| **IP rate limiting**           | AI endpoints use Upstash Redis-backed rate limiting to prevent abuse of Groq/OpenRouter quotas.                                                                                                                                                    |
| **Desktop sidecar auth**       | The local API sidecar requires a per-session `Bearer` token generated at launch. The token is stored in Rust state and injected into the sidecar environment — only the Tauri frontend can retrieve it via IPC. Health check endpoints are exempt. |
| **OS keychain storage**        | Desktop API keys are stored in the operating system's credential manager (macOS Keychain, Windows Credential Manager), never in plaintext files or environment variables on disk.                                                                  |
| **SSRF protection**            | Two-phase URL validation: protocol allowlist, private IP rejection, DNS rebinding detection, and TOCTOU-safe address pinning.                                                                                                                     |
| **IPC window hardening**       | All sensitive Tauri IPC commands gate on `require_trusted_window()` with a `TRUSTED_WINDOWS` allowlist.                                                                                                                                            |
| **Bot protection middleware**  | Edge Middleware blocks crawlers from `/api/*` routes. Social preview bots are selectively allowed on `/api/story` and `/api/og-story`.                                                                                                             |

---

## Regression Testing

The test suite includes **30 test files** with **554 individual test cases** across **147 describe blocks**, covering server handlers, caching behavior, data integrity, and map overlays.

**Unit & integration tests** (`npm test`) validate:

| Area | Test Files | Coverage |
| --- | --- | --- |
| **Server handlers** | `server-handlers`, `supply-chain-handlers`, `supply-chain-v2` | All 22 proto service handler imports, route registration, response schemas |
| **Caching** | `redis-caching`, `route-cache-tier`, `flush-stale-refreshes` | Cache key construction, TTL tiers, stale refresh coalescing, stampede prevention |
| **Data integrity** | `bootstrap`, `deploy-config`, `edge-functions` | Bootstrap key sync between `cache-keys.ts` and `bootstrap.js`, all 57 edge function self-containment (no `../server/` imports), version sync across package.json/tauri.conf.json/Cargo.toml |
| **Intelligence** | `military-classification`, `clustering`, `insights-loader`, `summarize-reasoning` | Military confidence scoring, news clustering algorithms, AI brief generation, LLM reasoning chain parsing |
| **Map & geo** | `countries-geojson`, `globe-2d-3d-parity`, `map-locale`, `geo-keyword-matching` | GeoJSON polygon validity, flat/globe layer parity, locale-aware map labels, 217-hub keyword matching |
| **Protocols** | `oref-proxy`, `oref-locations`, `oref-breaking`, `live-news-hls` | OREF alert parsing, 1480 Hebrew→English location translations, HLS stream detection |
| **Circuit breakers** | `hapi-gdelt-circuit-breakers`, `tech-readiness-circuit-breakers`, `smart-poll-loop` | Per-source failure isolation, adaptive backoff, hidden-tab throttling |
| **Data sources** | `gulf-fdi-data`, `ttl-acled-ais-guards`, `urlState` | Gulf FDI coordinate validation, ACLED/AIS TTL guards, URL state encoding/decoding |

**E2E map tests** use Playwright with the map harness (`/tests/map-harness.html`) for overlay behavior validation.

---

## Quick Start

```bash
# Clone and run
git clone https://github.com/suzarilshah/4tlas.git
cd 4tlas
npm install
npm run dev      # Starts Vite dev server
```

Open [http://localhost:5173](http://localhost:5173)

The frontend connects to the production Cloudflare Worker API (`4tlas-api.worldmonitor.workers.dev`) for data. For local API development, see [Self-Hosting](#self-hosting).

### Environment Variables (Optional)

The dashboard works without any API keys — panels for unconfigured services simply won't appear. For full functionality, copy the example file and fill in the keys you need:

```bash
cp .env.example .env.local
```

The `.env.example` file documents every variable with descriptions and registration links, organized by deployment target (Cloudflare vs Heroku). Key groups:

| Group             | Variables                                                                  | Free Tier                                  |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **AI (Local)**    | `OLLAMA_API_URL`, `OLLAMA_MODEL`                                           | Free (runs on your hardware)               |
| **AI (Cloud)**    | `GROQ_API_KEY`, `OPENROUTER_API_KEY`                                       | 14,400 req/day (Groq), 50/day (OpenRouter) |
| **Cache**         | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                       | 10K commands/day                           |
| **Markets**       | `FINNHUB_API_KEY`, `FRED_API_KEY`, `EIA_API_KEY`                           | All free tier                              |
| **Tracking**      | `WINGBITS_API_KEY`, `AISSTREAM_API_KEY`                                    | Free                                       |
| **Geopolitical**  | `ACLED_ACCESS_TOKEN`, `CLOUDFLARE_API_TOKEN`, `NASA_FIRMS_API_KEY`         | Free for researchers                       |
| **Relay**         | `HEROKU_RELAY_URL`, `VITE_WS_RELAY_URL`, `OPENSKY_CLIENT_ID/SECRET`        | Self-hosted                                |
| **UI**            | `VITE_VARIANT`, `VITE_MAP_INTERACTION_MODE` (`flat` or `3d`, default `3d`) | N/A                                        |
| **Observability** | `VITE_SENTRY_DSN` (optional, empty disables reporting)                     | N/A                                        |

See [`.env.example`](./.env.example) for the complete list with registration links.

---

## Self-Hosting

4tlas uses **Cloudflare Workers** for the API layer and **Cloudflare Pages** for the frontend. The `api/` directory contains **Vercel Edge Functions** as a fallback option.

### Option 1: Deploy to Cloudflare (Current)

**Frontend (Cloudflare Pages):**

```bash
npm run build
npx wrangler pages deploy dist --project-name worldmonitor
```

**API (Cloudflare Workers):**

```bash
npx wrangler deploy    # Deploys workers/index.ts
```

Add your API keys in the Cloudflare dashboard under **Workers → Settings → Variables**.

### Option 2: Deploy to Vercel (Fallback)

Vercel can run the edge functions in the `api/` directory:

```bash
npm install -g vercel
vercel          # Follow prompts to link/create project
```

Add your API keys in the Vercel dashboard under **Settings → Environment Variables**.

### Option 3: Local Development

```bash
npm run dev    # Vite dev server on http://localhost:5173
```

The frontend connects to the production Worker API. For full local development with the API, use the Vite proxy configuration in `vite.config.ts`.

### Platform Notes

| Platform               | Status                  | Notes                                                                                                                          |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Cloudflare**         | Full support            | Current deployment target (Workers + Pages)                                                                                    |
| **Vercel**             | Full support            | Fallback deployment target                                                                                                     |
| **Linux x86_64**       | Full support            | Desktop .AppImage available for x86_64                                                                                         |
| **macOS**              | Full support            | Full local development                                                                                                         |
| **Docker**             | Planned                 | See [Roadmap](#roadmap)                                                                                                        |

### Heroku Relay (Optional)

The Heroku relay is a multi-protocol gateway that handles data sources requiring persistent connections or residential proxying:

```bash
# On Heroku, deploy with:
node scripts/ais-relay.cjs
```

| Service                 | Protocol        | Purpose                                                              |
| ----------------------- | --------------- | -------------------------------------------------------------------- |
| **AIS Vessel Tracking** | WebSocket       | Live AIS maritime data with chokepoint detection and density grids   |
| **OpenSky Aircraft**    | REST (polling)  | Military flight tracking across merged query regions                 |
| **Telegram OSINT**      | MTProto (GramJS)| 26 OSINT channels polled on 60s cycle with FLOOD_WAIT handling       |
| **OREF Rocket Alerts**  | curl + proxy    | Israel Home Front Command sirens via residential proxy (Akamai WAF)  |

Set `HEROKU_RELAY_URL` and `VITE_WS_RELAY_URL` in your environment. Without the relay, AIS, OpenSky, Telegram, and OREF layers won't show live data, but all other features work normally.

---

## Tech Stack

| Category              | Technologies                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**          | Vanilla TypeScript (no framework), Vite, globe.gl + Three.js (3D globe), deck.gl + MapLibre GL (flat map), vite-plugin-pwa (service worker + manifest) |
| **Desktop**           | Tauri 2 (Rust) with Node.js sidecar, OS keychain integration (keyring crate), native TLS (reqwest)                                             |
| **AI/ML**             | Ollama / LM Studio (local, OpenAI-compatible), Groq (Llama 3.1 8B), OpenRouter (fallback), Transformers.js (browser-side T5, NER, embeddings), IndexedDB vector store (5K headline RAG) |
| **Caching**           | Redis (Upstash) — 3-tier cache with in-memory + Redis + upstream, cross-user AI deduplication. Vercel CDN (s-maxage). Service worker (Workbox) |
| **Geopolitical APIs** | OpenSky, GDELT, ACLED, UCDP, HAPI, USGS, GDACS, NASA EONET, NASA FIRMS, Polymarket, Cloudflare Radar, WorldPop, OREF (Israel sirens), gpsjam.org (GPS interference), Telegram MTProto (26 OSINT channels) |
| **Market APIs**       | Yahoo Finance (equities, forex, crypto), CoinGecko (stablecoins), mempool.space (BTC hashrate), alternative.me (Fear & Greed)                  |
| **Threat Intel APIs** | abuse.ch (Feodo Tracker, URLhaus), AlienVault OTX, AbuseIPDB, C2IntelFeeds                                                                     |
| **Economic APIs**     | FRED (Federal Reserve), EIA (Energy), Finnhub (stock quotes)                                                                                   |
| **Localization**      | i18next (21 languages: en, bg, ro, fr, de, es, it, pl, pt, nl, sv, ru, ar, zh, ja, tr, th, vi, cs, el, ko), RTL support, lazy-loaded bundles, native-language feeds for 21 locales with one-time locale boost |
| **API Contracts**     | Protocol Buffers (92 proto files, 22 services), sebuf HTTP annotations, buf CLI (lint + breaking checks), auto-generated TypeScript clients/servers + OpenAPI 3.1.0 docs |
| **Analytics**         | Vercel Analytics (privacy-first, lightweight web vitals and page view tracking)                                                                 |
| **Deployment**        | Cloudflare Workers + Pages (primary), Vercel Edge Functions (fallback), Heroku (WebSocket relay + Telegram + OREF), Tauri (macOS/Windows/Linux), PWA (installable) |
| **Finance Data**      | 92 stock exchanges, 19 financial centers, 13 central banks, 10 commodity hubs, 64 Gulf FDI investments                                         |
| **Data**              | 435+ RSS feeds across all 4 variants, ADS-B transponders, AIS maritime data, VIIRS satellite imagery, 30+ live video channels (8+ default YouTube + 18+ HLS native), 26 Telegram OSINT channels |

---

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines, including the Sebuf RPC framework workflow, how to add data sources and RSS feeds, and our AI-assisted development policy. The project also maintains a [Code of Conduct](./CODE_OF_CONDUCT.md) and [Security Policy](./SECURITY.md) for responsible vulnerability disclosure.

```bash
# Development
npm run dev          # Full variant (4tlas)
npm run dev:tech     # Tech variant (Tech Monitor)
npm run dev:finance  # Finance variant (Finance Monitor)
npm run dev:commodity  # Commodity variant
npm run dev:happy      # Happy variant

# Production builds
npm run build:full       # Build full variant
npm run build:tech       # Build tech variant
npm run build:finance    # Build finance variant
npm run build:commodity  # Build commodity variant
npm run build:happy      # Build happy variant

# Quality (also runs automatically on PRs via GitHub Actions)
npm run typecheck    # TypeScript type checking (tsc --noEmit)

# Desktop packaging
npm run desktop:package:macos:full      # .app + .dmg (4tlas)
npm run desktop:package:macos:tech      # .app + .dmg (Tech Monitor)
npm run desktop:package:macos:finance   # .app + .dmg (Finance Monitor)
npm run desktop:package:windows:full    # .exe + .msi (4tlas)
npm run desktop:package:windows:tech    # .exe + .msi (Tech Monitor)
npm run desktop:package:windows:finance # .exe + .msi (Finance Monitor)

# Generic packaging runner
npm run desktop:package -- --os macos --variant full

# Signed packaging (same targets, requires signing env vars)
npm run desktop:package:macos:full:sign
npm run desktop:package:windows:full:sign
```

Desktop release details, signing hooks, variant outputs, and clean-machine validation checklist:

- [docs/RELEASE_PACKAGING.md](./docs/RELEASE_PACKAGING.md)

---

## Roadmap

**Completed highlights** — 4 variant dashboards, 60+ edge functions, dual map engine, native desktop app (Tauri), 21 languages, proto-first API contracts, AI summarization + deduction + RAG, 30+ live video streams, Telegram OSINT, OREF rocket alerts, CII scoring, cross-stream correlation, and much more.

**Upcoming:**

- [ ] Mobile-optimized views
- [ ] Push notifications for critical alerts
- [ ] Self-hosted Docker image

See [full roadmap](./docs/DOCUMENTATION.md#roadmap).

---

## Support the Project

If you find 4tlas useful:

- **Star this repo** to help others discover it
- **Share** with colleagues interested in OSINT
- **Contribute** code, data sources, or documentation
- **Report issues** to help improve the platform

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** — see [LICENSE](LICENSE) for the full text.

### What This Means

**You are free to:**

- **Use** — run 4tlas for any purpose, including commercial use
- **Study** — read, audit, and learn from the source code
- **Modify** — adapt, extend, and build upon the code
- **Distribute** — share copies with anyone

**Under these conditions:**

- **Source code disclosure** — if you distribute or modify this software, you **must** make the complete source code available under the same AGPL-3.0 license
- **Network use is distribution** — if you run a modified version as a network service (SaaS, web app, API), you **must** provide the source code to all users who interact with it over the network. This is the key difference from GPL-3.0 — you cannot run a modified version behind a server without sharing the source
- **Same license (copyleft)** — any derivative work must be released under AGPL-3.0. You cannot re-license under a proprietary or more permissive license
- **Attribution** — you must retain all copyright notices, give appropriate credit to the original author, and clearly indicate any changes you made
- **State changes** — modified files must carry prominent notices stating that you changed them, with the date of the change
- **No additional restrictions** — you may not impose any further restrictions on the rights granted by this license (e.g., no DRM, no additional terms)

**In plain terms:**

| Use Case | Allowed? | Condition |
|----------|----------|-----------|
| Personal / internal use | Yes | No conditions |
| Self-hosted deployment | Yes | No conditions if unmodified |
| Forking & modifying | Yes | Must share source under AGPL-3.0 |
| Commercial use | Yes | Must share source under AGPL-3.0 |
| Running as a SaaS/web service | Yes | Must share source under AGPL-3.0 |
| Bundling into a proprietary product | No | AGPL-3.0 copyleft prevents this |

**No warranty** — the software is provided "as is" without warranty of any kind.

Copyright (C) 2024-2026 Elie Habib. All rights reserved under AGPL-3.0.

---

## Author

**Elie Habib** — [GitHub](https://github.com/koala73)

---

## Contributors

<a href="https://github.com/suzarilshah/4tlas/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=suzarilshah/4tlas" />
</a>

---

## Security Acknowledgments

We thank the following researchers for responsibly disclosing security issues:

- **Cody Richard** — Disclosed three security findings covering IPC command exposure via DevTools in production builds, renderer-to-sidecar trust boundary analysis, and the global fetch patch credential injection architecture (2026)

If you discover a vulnerability, please see our [Security Policy](./SECURITY.md) for responsible disclosure guidelines.

---

<p align="center">
  <a href="https://4tlas.pages.dev">4tlas.pages.dev</a>
</p>

## Star History

<a href="https://api.star-history.com/svg?repos=suzarilshah/4tlas&type=Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=suzarilshah/4tlas&type=Date&theme=dark" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=suzarilshah/4tlas&type=Date" />
 </picture>
</a>
