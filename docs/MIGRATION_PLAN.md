# Service Consolidation Migration Plan

Migration from Vercel + Upstash + Convex + Railway + Groq/OpenRouter to Cloudflare + Neon DB + Azure AI Foundry + Heroku.

---

## Current Architecture

| Component | Current Service | Monthly Cost (Est.) |
|-----------|----------------|---------------------|
| Frontend Hosting | Vercel | Free tier |
| Edge Functions | Vercel Edge Runtime | Free tier |
| Caching | Upstash Redis | Free tier |
| Registration DB | Convex | Free tier |
| AI Summarization | Groq (primary) + OpenRouter (fallback) | Free tiers |
| Relay Server | Railway | ~$5-20 |
| Map Tiles | Cloudflare R2 (optional) | Pay-as-you-go |
| Error Tracking | Sentry | Free tier |
| Analytics | Vercel Analytics | Free tier |

---

## Target Architecture

| Component | Target Service | Replaces |
|-----------|---------------|----------|
| Frontend Hosting | Cloudflare Pages | Vercel hosting |
| Edge Functions | Cloudflare Workers | Vercel edge functions |
| Caching | Cloudflare KV | Upstash Redis |
| Persistent DB | Neon PostgreSQL | Convex |
| AI Summarization | Azure AI Foundry | Groq + OpenRouter |
| Relay Server | Heroku | Railway |
| Static Assets | Cloudflare R2 | (same) |
| Error Tracking | Sentry | (keep) |
| Analytics | Cloudflare Web Analytics | Vercel Analytics |

---

## Phase 1: Neon DB Setup (Replace Convex)

### 1.1 Create Neon Database

1. Sign up at https://neon.tech
2. Create a new project: `worldmonitor-prod`
3. Note your connection string

### 1.2 Database Schema

Create this schema in Neon:

```sql
-- Registrations table (replaces Convex registrations)
CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    normalized_email VARCHAR(320) NOT NULL UNIQUE,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    source VARCHAR(100) DEFAULT 'unknown',
    app_version VARCHAR(100) DEFAULT 'unknown',
    referral_code VARCHAR(20) UNIQUE,
    referred_by VARCHAR(20),
    referral_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_registrations_normalized_email ON registrations(normalized_email);
CREATE INDEX idx_registrations_referral_code ON registrations(referral_code);

-- Counters table (replaces Convex counters)
CREATE TABLE counters (
    name VARCHAR(100) PRIMARY KEY,
    value INTEGER DEFAULT 0
);

-- Initialize registration counter
INSERT INTO counters (name, value) VALUES ('registrations_total', 0);
```

### 1.3 New Registration API

Create `server/_shared/neon.ts`:

```typescript
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

export async function query(sql: string, params: unknown[] = []): Promise<unknown[]> {
  if (!NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL not configured');

  const response = await fetch(`${NEON_DATABASE_URL}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, params }),
  });

  if (!response.ok) throw new Error(`Neon query failed: ${response.status}`);
  const result = await response.json();
  return result.rows || [];
}

export async function registerUser(
  email: string,
  source: string,
  appVersion: string,
  referredBy?: string
): Promise<{ status: string; referralCode: string; referralCount: number; position?: number }> {
  const normalizedEmail = email.trim().toLowerCase();

  // Check existing
  const existing = await query(
    'SELECT referral_code, referral_count FROM registrations WHERE normalized_email = $1',
    [normalizedEmail]
  );

  if (existing.length > 0) {
    const row = existing[0] as { referral_code: string; referral_count: number };
    return {
      status: 'already_registered',
      referralCode: row.referral_code || '',
      referralCount: row.referral_count || 0,
    };
  }

  // Generate referral code
  const referralCode = generateReferralCode(normalizedEmail);

  // Credit referrer if applicable
  if (referredBy) {
    await query(
      'UPDATE registrations SET referral_count = referral_count + 1 WHERE referral_code = $1',
      [referredBy]
    );
  }

  // Get and increment position
  await query('UPDATE counters SET value = value + 1 WHERE name = $1', ['registrations_total']);
  const positionResult = await query('SELECT value FROM counters WHERE name = $1', ['registrations_total']);
  const position = (positionResult[0] as { value: number })?.value || 0;

  // Insert registration
  await query(
    `INSERT INTO registrations (email, normalized_email, source, app_version, referral_code, referred_by, referral_count)
     VALUES ($1, $2, $3, $4, $5, $6, 0)`,
    [email.trim(), normalizedEmail, source, appVersion, referralCode, referredBy || null]
  );

  return {
    status: 'registered',
    referralCode,
    referralCount: 0,
    position,
  };
}

function generateReferralCode(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 8);
}
```

---

## Phase 2: Cloudflare Setup

### 2.1 Create Cloudflare Account & Project

1. Sign up at https://cloudflare.com
2. Add your domain: `worldmonitor.app`
3. Create a Pages project: `worldmonitor`

### 2.2 Create KV Namespaces (Replace Upstash Redis)

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# Note the IDs for wrangler.toml
```

### 2.3 Create R2 Bucket (Static Assets)

```bash
wrangler r2 bucket create worldmonitor-assets
```

### 2.4 wrangler.toml Configuration

Create `wrangler.toml` in project root:

```toml
name = "worldmonitor"
main = "workers/index.ts"
compatibility_date = "2024-01-01"

# KV Namespaces
[[kv_namespaces]]
binding = "CACHE"
id = "<YOUR_KV_NAMESPACE_ID>"
preview_id = "<YOUR_PREVIEW_KV_NAMESPACE_ID>"

# R2 Bucket
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "worldmonitor-assets"

# Environment variables (set via dashboard or wrangler secret)
[vars]
ENVIRONMENT = "production"

# Routes
routes = [
  { pattern = "worldmonitor.app/api/*", zone_name = "worldmonitor.app" },
  { pattern = "tech.worldmonitor.app/api/*", zone_name = "worldmonitor.app" },
  { pattern = "finance.worldmonitor.app/api/*", zone_name = "worldmonitor.app" }
]
```

---

## Phase 3: Migrate Redis to Cloudflare KV

### 3.1 Create KV Adapter

Create `server/_shared/kv.ts`:

```typescript
// Cloudflare KV adapter with same interface as redis.ts

interface KVNamespace {
  get(key: string, options?: { type: 'json' | 'text' }): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

declare const CACHE: KVNamespace;

const KV_OP_TIMEOUT_MS = 1500;

function getKeyPrefix(): string {
  const env = (globalThis as { ENVIRONMENT?: string }).ENVIRONMENT;
  if (!env || env === 'production') return '';
  return `${env}:`;
}

let cachedPrefix: string | undefined;
function prefixKey(key: string): string {
  if (cachedPrefix === undefined) cachedPrefix = getKeyPrefix();
  if (!cachedPrefix) return key;
  return `${cachedPrefix}${key}`;
}

export async function getCachedJson(key: string): Promise<unknown | null> {
  try {
    const result = await Promise.race([
      CACHE.get(prefixKey(key), { type: 'json' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), KV_OP_TIMEOUT_MS))
    ]);
    return result ?? null;
  } catch (err) {
    console.warn('[kv] getCachedJson failed:', err);
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await CACHE.put(prefixKey(key), JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch (err) {
    console.warn('[kv] setCachedJson failed:', err);
  }
}

// In-flight request coalescing (same as redis.ts)
const inflight = new Map<string, Promise<unknown>>();
const NEG_SENTINEL = '__WM_NEG__';

export async function cachedFetchJson<T extends object>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>,
  negativeTtlSeconds = 120
): Promise<T | null> {
  const cached = await getCachedJson(key);
  if (cached === NEG_SENTINEL) return null;
  if (cached !== null) return cached as T;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T | null>;

  const promise = fetcher()
    .then(async (result) => {
      if (result != null) {
        await setCachedJson(key, result, ttlSeconds);
      } else {
        await setCachedJson(key, NEG_SENTINEL, negativeTtlSeconds);
      }
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
```

### 3.2 Migration Strategy

The KV adapter maintains the same interface as `redis.ts`. To migrate:

1. Deploy both Redis and KV adapters initially
2. Use feature flag to switch between them
3. Once validated, remove Redis adapter

---

## Phase 4: Migrate Edge Functions to Cloudflare Workers

### 4.1 Worker Entry Point

Create `workers/index.ts`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import RPC handlers
import { handleAviation } from './api/aviation';
import { handleMarket } from './api/market';
import { handleIntelligence } from './api/intelligence';
// ... other handlers

const app = new Hono();

// CORS middleware
app.use('/api/*', cors({
  origin: ['https://worldmonitor.app', 'https://tech.worldmonitor.app', 'https://finance.worldmonitor.app'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-WorldMonitor-Key'],
}));

// Bot filtering middleware (from middleware.ts)
app.use('/api/*', async (c, next) => {
  const ua = c.req.header('user-agent') ?? '';
  const BOT_UA = /bot|crawl|spider|slurp|archiver|wget|curl\/|python-requests/i;

  if (BOT_UA.test(ua) || !ua || ua.length < 10) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await next();
});

// API routes
app.route('/api/aviation/v1', handleAviation);
app.route('/api/market/v1', handleMarket);
app.route('/api/intelligence/v1', handleIntelligence);
// ... other routes

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

export default app;
```

### 4.2 Migration Checklist for Each API

For each file in `api/`:

1. [ ] Convert Vercel edge function to Hono handler
2. [ ] Replace `@upstash/redis` imports with `./kv`
3. [ ] Update environment variable access (`c.env.VAR` instead of `process.env.VAR`)
4. [ ] Test locally with `wrangler dev`

### 4.3 Key Differences: Vercel vs Cloudflare Workers

| Feature | Vercel Edge | Cloudflare Workers |
|---------|-------------|-------------------|
| Runtime | V8 isolate | V8 isolate |
| Env vars | `process.env.X` | `env.X` (via context) |
| KV/Cache | Upstash REST API | Native KV binding |
| Request | `Request` object | `Request` via Hono |
| Response | `Response` object | `Response` via Hono |

---

## Phase 5: Azure AI Foundry Setup

### 5.1 Create Azure AI Resource

1. Go to https://ai.azure.com
2. Create new AI Foundry resource
3. Deploy a model (e.g., `gpt-4o-mini` or `gpt-4`)
4. Note your endpoint and API key

### 5.2 Update Summarization Service

Modify `src/services/summarization.ts`:

```typescript
const AZURE_AI_ENDPOINT = process.env.AZURE_AI_ENDPOINT;
const AZURE_AI_KEY = process.env.AZURE_AI_KEY;
const AZURE_AI_DEPLOYMENT = process.env.AZURE_AI_DEPLOYMENT || 'gpt-4o-mini';

export async function summarizeWithAI(text: string): Promise<string | null> {
  if (!AZURE_AI_ENDPOINT || !AZURE_AI_KEY) {
    console.warn('[summarize] Azure AI not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${AZURE_AI_ENDPOINT}/openai/deployments/${AZURE_AI_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_AI_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a concise news summarizer. Summarize in 2-3 sentences.' },
            { role: 'user', content: text }
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      console.error('[summarize] Azure AI error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error('[summarize] Azure AI failed:', err);
    return null;
  }
}
```

---

## Phase 6: Heroku Relay Server

### 6.1 Create Heroku App

```bash
# Install Heroku CLI
brew install heroku/brew/heroku

# Login
heroku login

# Create app
heroku create worldmonitor-relay

# Set environment variables
heroku config:set AISSTREAM_API_KEY=your_key
heroku config:set TELEGRAM_API_ID=your_id
heroku config:set TELEGRAM_API_HASH=your_hash
heroku config:set TELEGRAM_SESSION=your_session
heroku config:set RELAY_SHARED_SECRET=your_secret
heroku config:set UPSTASH_REDIS_REST_URL=your_url
heroku config:set UPSTASH_REDIS_REST_TOKEN=your_token
# ... other env vars
```

### 6.2 Create Procfile

Create `scripts/Procfile`:

```
web: node ais-relay.cjs
```

### 6.3 Deploy to Heroku

```bash
cd scripts
git init
heroku git:remote -a worldmonitor-relay
git add .
git commit -m "Deploy relay server"
git push heroku main
```

---

## Phase 7: Environment Variables

### 7.1 Cloudflare Workers Secrets

```bash
# Database
wrangler secret put NEON_DATABASE_URL

# Azure AI
wrangler secret put AZURE_AI_ENDPOINT
wrangler secret put AZURE_AI_KEY

# External APIs (keep existing)
wrangler secret put FINNHUB_API_KEY
wrangler secret put AVIATIONSTACK_API
wrangler secret put ACLED_ACCESS_TOKEN
# ... etc
```

### 7.2 New .env.example Entries

Add to `.env.example`:

```bash
# ------ Neon Database (replaces Convex) ------
NEON_DATABASE_URL=

# ------ Azure AI Foundry (replaces Groq/OpenRouter) ------
AZURE_AI_ENDPOINT=
AZURE_AI_KEY=
AZURE_AI_DEPLOYMENT=gpt-4o-mini

# ------ Cloudflare ------
# (KV and R2 are bound via wrangler.toml, no env vars needed)
```

---

## Migration Sequence

### Week 1: Parallel Infrastructure
1. Set up Neon DB with schema
2. Set up Cloudflare Pages/Workers/KV
3. Set up Azure AI Foundry
4. Keep existing infrastructure running

### Week 2: Data Migration
1. Export Convex registrations to Neon
2. Deploy Workers alongside Vercel (different routes)
3. Test all API endpoints

### Week 3: Traffic Migration
1. Switch DNS to Cloudflare
2. Route 10% traffic to Workers
3. Monitor for errors
4. Gradually increase to 100%

### Week 4: Relay Migration
1. Deploy relay to Heroku
2. Update `WS_RELAY_URL` to Heroku
3. Verify AIS/OpenSky/Telegram feeds
4. Decommission Railway

### Week 5: Cleanup
1. Remove Vercel deployment
2. Remove Upstash Redis
3. Remove Convex
4. Archive Railway
5. Update documentation

---

## Rollback Plan

If issues arise:

1. **DNS**: Cloudflare allows instant DNS rollback
2. **API**: Keep Vercel deployment for 30 days
3. **Data**: Neon has point-in-time recovery
4. **Relay**: Railway can be reactivated

---

## Cost Comparison

| Service | Current (Free Tiers) | Target (Free Tiers) |
|---------|---------------------|---------------------|
| Hosting | Vercel Free | Cloudflare Pages Free |
| Edge Functions | Vercel 100K/month | Workers 100K/day |
| Caching | Upstash 10K/day | KV 100K reads/day |
| Database | Convex 1M rows | Neon 3GB storage |
| AI | Groq 14.4K/day | Azure $0 (with credits) |
| Relay | Railway $5-20/mo | Heroku Free (eco dyno) |

**Estimated savings**: ~$5-20/month (Railway costs)
**Benefits**: Unified Cloudflare dashboard, better KV performance, PostgreSQL flexibility

---

## Files to Modify

| File | Change |
|------|--------|
| `server/_shared/redis.ts` | Add KV fallback or replace |
| `api/register-interest.js` | Switch from Convex to Neon |
| `convex/*` | Archive (keep for reference) |
| `src/services/summarization.ts` | Switch to Azure AI |
| `src/main.ts` | Replace Vercel Analytics |
| `package.json` | Remove `convex`, `@upstash/*` deps |
| `vercel.json` | Archive |
| `wrangler.toml` | Create new |
| `.env.example` | Update with new vars |

---

## Testing Checklist

- [ ] Registration flow works with Neon
- [ ] All API endpoints respond correctly
- [ ] Caching works via Cloudflare KV
- [ ] AI summarization works via Azure
- [ ] AIS vessel data flows from Heroku relay
- [ ] OpenSky aircraft data flows
- [ ] Telegram feed works
- [ ] Map tiles load from R2
- [ ] All variants work (full, tech, finance, happy)
- [ ] Desktop app connects successfully
