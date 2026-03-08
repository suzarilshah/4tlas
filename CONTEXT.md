# World Monitor - Project Context

> Comprehensive context document for AI assistants and IDE integrations.

---

## Project Overview

**World Monitor** is a real-time global intelligence dashboard providing AI-powered news aggregation, geopolitical monitoring, and infrastructure tracking. It's a production-grade OSINT platform built with vanilla TypeScript.

| Property | Value |
|----------|-------|
| **Version** | 2.5.25 |
| **License** | AGPL-3.0-only |
| **Repository** | github.com/koala73/worldmonitor |
| **Node.js** | v20.19+ or v22.12+ required |
| **Package Manager** | npm |

---

## Live Deployments

| Variant | URL | Focus |
|---------|-----|-------|
| **World Monitor** | https://worldmonitor.app | Geopolitics, military, conflicts |
| **Tech Monitor** | https://tech.worldmonitor.app | AI/ML, startups, cybersecurity |
| **Finance Monitor** | https://finance.worldmonitor.app | Markets, trading, central banks |
| **Commodity Monitor** | https://commodity.worldmonitor.app | Mining, metals, energy |
| **Happy Monitor** | https://happy.worldmonitor.app | Good news, positive trends |

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla TypeScript, Vite 6.0.7, no framework |
| **Maps** | globe.gl + Three.js (3D), deck.gl + MapLibre (2D) |
| **Desktop** | Tauri 2 (Rust) with Node.js sidecar |
| **API** | Vercel Edge Functions (60+ endpoints) |
| **Workers** | Cloudflare Workers (alternative deployment) |
| **AI/ML** | Ollama, Groq, OpenRouter, Transformers.js (browser) |
| **Caching** | Upstash Redis (3-tier: memory → Redis → upstream) |
| **Database** | Convex (registration), Neon (optional) |

### Directory Structure

```
worldmonitor/
├── src/                      # Frontend application
│   ├── App.ts               # Main orchestrator class
│   ├── app/                 # Core modules
│   │   ├── app-context.ts       # Shared state interface
│   │   ├── data-loader.ts       # Data fetching orchestration
│   │   ├── panel-layout.ts      # Panel management
│   │   ├── refresh-scheduler.ts # Adaptive polling with jitter
│   │   ├── event-handlers.ts    # UI event handling
│   │   ├── search-manager.ts    # Search indexing
│   │   ├── country-intel.ts     # Country brief logic
│   │   └── desktop-updater.ts   # Tauri update checks
│   ├── components/          # 74 UI panel classes
│   │   ├── Panel.ts             # Base panel class
│   │   ├── VirtualList.ts       # Virtualized scrolling
│   │   ├── DeckGLMap.ts         # 2D WebGL map
│   │   ├── GlobeMap.ts          # 3D globe
│   │   ├── NewsPanel.ts         # RSS news display
│   │   ├── LiveNewsPanel.ts     # Real-time news
│   │   ├── MarketPanel.ts       # Stock/crypto quotes
│   │   ├── CountryBriefPage.ts  # Full-page country dossier
│   │   └── ...
│   ├── services/            # 89 service modules
│   │   ├── rss.ts               # RSS feed aggregation
│   │   ├── clustering.ts        # News event clustering
│   │   ├── country-instability.ts # CII scoring algorithm
│   │   ├── threat-classifier.ts # Threat classification
│   │   ├── ml-worker.ts         # Browser ML via Web Workers
│   │   ├── summarization.ts     # AI summary pipeline
│   │   ├── i18n.ts              # 21-language support
│   │   ├── bootstrap.ts         # Hydration from Redis
│   │   └── ...
│   ├── config/              # Static configuration
│   │   ├── index.ts             # Main config exports
│   │   ├── variant.ts           # Site variant detection
│   │   ├── feeds.ts             # 435+ RSS feed definitions
│   │   ├── panels.ts            # Panel/layer defaults
│   │   ├── geo.ts               # Cables, hotspots, bases data
│   │   ├── markets.ts           # Market symbols
│   │   └── variants/            # Per-variant configs
│   ├── types/               # TypeScript definitions
│   │   └── index.ts             # All shared types
│   └── utils/               # Utility functions
├── api/                     # Vercel Edge Functions
│   ├── [domain]/v1/[rpc].ts    # Proto RPC endpoints
│   ├── bootstrap.js            # Hydration endpoint
│   ├── rss-proxy.js            # CORS proxy for RSS
│   └── ...                     # 60+ endpoints
├── server/                  # Server-side handlers
│   ├── gateway.ts              # API router
│   ├── router.ts               # RPC routing
│   ├── worldmonitor/           # 22 service domains
│   │   ├── aviation/v1/        # Flight tracking
│   │   ├── conflict/v1/        # ACLED, UCDP events
│   │   ├── intelligence/v1/    # AI deduction
│   │   ├── market/v1/          # Quotes, ETFs
│   │   ├── news/v1/            # RSS aggregation
│   │   └── ...
│   └── _shared/                # Redis, caching, rate limiting
├── workers/                 # Cloudflare Workers
│   └── index.ts                # Worker entry point
├── proto/                   # Protocol Buffers (92 files)
│   └── worldmonitor/           # Typed service contracts
├── src-tauri/               # Tauri desktop app
│   ├── src/                    # Rust source
│   ├── sidecar/                # Node.js local API server
│   └── tauri.conf.json         # Tauri configuration
├── scripts/                 # Build & utility scripts
│   ├── ais-relay.cjs           # Railway relay server
│   └── ...
├── tests/                   # Test suites
├── e2e/                     # Playwright E2E tests
├── docs/                    # Documentation
├── public/                  # Static assets
├── vercel.json              # Vercel configuration
├── wrangler.toml            # Cloudflare Workers config
└── vite.config.ts           # Vite build configuration
```

---

## Key Algorithms

### Country Instability Index (CII)
Real-time 0-100 stability score using weighted multi-signal blend:
- News velocity & sentiment
- Security threat levels
- Economic indicators
- Conflict proximity
- Implementation: `src/services/country-instability.ts`

### Hotspot Escalation Scoring
Dynamic scoring for conflict zones:
- News activity contribution
- CII contribution
- Geo-convergence signals
- Military activity
- Implementation: `src/services/hotspot-escalation.ts`

### Threat Classification
3-tier classification pipeline:
1. Instant keyword matching
2. Async browser ML (Transformers.js)
3. LLM override (Groq/OpenRouter)
- Implementation: `src/services/threat-classifier.ts`

### AI Summarization
4-tier fallback chain:
1. Ollama (local)
2. Groq API
3. OpenRouter API
4. Browser T5 (Transformers.js)
- Implementation: `src/services/summarization.ts`

---

## Data Sources

### Static Data (in `src/config/`)
- 435+ RSS feeds across 15 categories
- 210+ military bases worldwide
- 45 undersea cable routes
- 80+ pipelines (oil, gas, hydrogen)
- 111 AI datacenters
- 83 strategic ports
- 107 monitored airports
- 92 stock exchanges
- Nuclear facilities, spaceports, hotspots

### External APIs (require keys)
| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Groq | AI summaries | 14,400 req/day |
| Finnhub | Stock quotes | Yes |
| FRED | Economic data | Yes |
| EIA | Energy data | Yes |
| ACLED | Conflict events | Researchers |
| NASA FIRMS | Wildfire detection | Yes |
| Cloudflare Radar | Internet outages | Yes |
| AISStream | Vessel tracking | Yes |
| OpenSky | Aircraft tracking | Yes |

---

## Development Commands

```bash
# Install dependencies
npm install

# Development (requires vercel CLI for full API)
vercel dev              # Full stack with edge functions
npm run dev             # Frontend only (Vite)
npm run dev:tech        # Tech variant
npm run dev:finance     # Finance variant
npm run dev:happy       # Happy variant

# Build
npm run build           # Production build
npm run build:full      # Full variant
npm run build:tech      # Tech variant

# Desktop (Tauri)
npm run desktop:dev     # Development with devtools
npm run desktop:build:full  # Production build

# Testing
npm run typecheck       # TypeScript checking
npm run test:data       # Unit tests (554 cases)
npm run test:e2e        # Playwright E2E tests
npm run test:feeds      # Validate RSS feeds

# Cloudflare Workers (requires: npm i -D wrangler)
npx wrangler dev        # Local worker development
npx wrangler deploy     # Deploy to Cloudflare
```

---

## Environment Variables

### Essential (for full functionality)
```env
# Caching (required for production)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# AI Summarization
GROQ_API_KEY=           # Primary (14,400 req/day free)
OPENROUTER_API_KEY=     # Fallback (50 req/day free)

# Market Data
FINNHUB_API_KEY=
```

### Optional Data Sources
```env
FRED_API_KEY=           # Economic data
EIA_API_KEY=            # Energy data
NASA_FIRMS_API_KEY=     # Wildfire detection
CLOUDFLARE_API_TOKEN=   # Internet outages
ACLED_ACCESS_TOKEN=     # Conflict data
AVIATIONSTACK_API=      # Flight data
```

### Real-time Tracking (Railway Relay)
```env
AISSTREAM_API_KEY=      # Vessel tracking
OPENSKY_CLIENT_ID=      # Aircraft tracking
OPENSKY_CLIENT_SECRET=
TELEGRAM_API_ID=        # Telegram OSINT
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
WS_RELAY_URL=           # Relay server URL
RELAY_SHARED_SECRET=    # Auth secret
```

### Site Configuration
```env
VITE_VARIANT=full       # full | tech | finance | happy | commodity
VITE_WS_API_URL=        # API redirect URL
VITE_SENTRY_DSN=        # Error reporting
VITE_MAP_INTERACTION_MODE=3d  # 3d | flat
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.ts` | Main application orchestrator |
| `src/app/data-loader.ts` | All data fetching logic |
| `src/app/app-context.ts` | Shared application state |
| `src/config/index.ts` | Configuration exports |
| `src/config/feeds.ts` | RSS feed definitions |
| `src/config/panels.ts` | Panel & layer defaults |
| `src/config/geo.ts` | Geospatial static data |
| `src/services/country-instability.ts` | CII algorithm |
| `src/services/summarization.ts` | AI summary pipeline |
| `src/components/DeckGLMap.ts` | 2D map implementation |
| `src/components/GlobeMap.ts` | 3D globe implementation |
| `server/gateway.ts` | API router |
| `api/bootstrap.js` | Hydration endpoint |

---

## Variant System

Single codebase produces 5 specialized dashboards via `VITE_VARIANT`:

| Variant | Env Value | Panels Enabled | Layers Enabled |
|---------|-----------|----------------|----------------|
| Full (Geopolitical) | `full` | All 74 panels | All 45 layers |
| Tech | `tech` | Tech-focused subset | Cloud, datacenters, cyber |
| Finance | `finance` | Market-focused subset | Exchanges, central banks |
| Commodity | `commodity` | Mining/energy subset | Mines, ports, pipelines |
| Happy | `happy` | Positive news only | Minimal (no conflicts) |

Variant detection: `src/config/variant.ts`

---

## Deployment Platforms

### Vercel (Primary)
- Frontend: Static files with ISR
- API: 60+ Edge Functions
- Config: `vercel.json`

### Cloudflare (Alternative)
- Pages: Static frontend
- Workers: API endpoints
- KV: Caching layer
- Config: `wrangler.toml`
- Worker: `workers/index.ts`
- Note: `wrangler` CLI not in devDeps - install separately

### Railway (Relay Server)
- AIS vessel streaming
- OpenSky aircraft data
- RSS proxy
- Telegram OSINT poller
- Entry: `scripts/ais-relay.cjs`

### Desktop (Tauri)
- macOS, Windows, Linux
- Local Node.js sidecar
- Cloud API fallback
- Config: `src-tauri/tauri.conf.json`

---

## Testing

| Type | Command | Files |
|------|---------|-------|
| Unit | `npm run test:data` | `tests/*.test.mjs` |
| E2E | `npm run test:e2e` | `e2e/*.spec.ts` |
| Visual | `npm run test:e2e:visual` | Golden screenshots |
| Feeds | `npm run test:feeds` | RSS validation |
| Types | `npm run typecheck` | TypeScript |

---

## Common Tasks

### Add a new panel
1. Create `src/components/MyPanel.ts` extending `Panel`
2. Register in `src/config/panels.ts` (DEFAULT_PANELS)
3. Import in `src/components/index.ts`
4. Add to `src/app/panel-layout.ts`

### Add a new API endpoint
1. Create handler in `server/worldmonitor/[domain]/v1/`
2. Register in `server/worldmonitor/[domain]/v1/handler.ts`
3. Create edge function in `api/[domain]/v1/[rpc].ts`

### Add a new data layer
1. Define data in `src/config/geo.ts` or appropriate config
2. Add layer toggle in `src/types/index.ts` (MapLayers)
3. Implement rendering in `src/components/DeckGLMap.ts`
4. Add loading logic in `src/app/data-loader.ts`

### Add a new RSS feed
1. Add to `src/config/feeds.ts` (FEEDS array)
2. Assign tier in SOURCE_TIERS
3. Run `npm run test:feeds` to validate

---

## Coding Conventions

- **No framework** - Direct DOM manipulation
- **TypeScript strict mode** - All files use strict typing
- **ES modules** - `import/export` syntax
- **Async/await** - No raw promises where possible
- **Functional services** - Services export functions, not classes
- **Panel classes** - UI components extend `Panel` base class
- **Path aliases** - `@/` maps to `src/`

---

## Important Notes

1. **Dependencies already installed**: `node_modules` has 621 packages
2. **npm cache issue**: May need `sudo chown -R $(whoami) ~/.npm`
3. **Node version**: Requires v20.19+ or v22.12+
4. **Vercel CLI**: Required for full API functionality locally
5. **Wrangler CLI**: Not included in devDependencies - install with `npm i -D wrangler` for Cloudflare Workers
6. **Graceful degradation**: Missing API keys hide corresponding panels

---

## Links

- Documentation: `docs/DOCUMENTATION.md`
- Architecture: `docs/ARCHITECTURE.md`
- API Reference: `docs/API.md`
- Algorithms: `docs/ALGORITHMS.md`
- Data Sources: `docs/DATA_SOURCES.md`
