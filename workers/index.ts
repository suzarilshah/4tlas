/**
 * Cloudflare Workers entry point for World Monitor API
 * Replaces Vercel Edge Functions
 */

export interface Env {
  // KV Namespace for caching (replaces Upstash Redis)
  CACHE: KVNamespace;

  // Environment variables
  ENVIRONMENT: string;
  NEON_DATABASE_URL: string;
  AZURE_AI_ENDPOINT: string;
  AZURE_AI_KEY: string;
  HEROKU_RELAY_URL: string;
  RELAY_SHARED_SECRET: string;

  // External API keys
  FINNHUB_API_KEY: string;
  ACLED_ACCESS_TOKEN: string;
  CLOUDFLARE_API_TOKEN: string;
  // ... add more as needed
}

// Bot detection regex
const BOT_UA = /bot|crawl|spider|slurp|archiver|wget|curl\/|python-requests|scrapy|httpclient|go-http|java\/|libwww|perl|ruby|php\/|ahrefsbot|semrushbot|mj12bot|dotbot|baiduspider|yandexbot|sogou|bytespider|petalbot|gptbot|claudebot|ccbot/i;

// CORS headers
function corsHeaders(origin: string | null): HeadersInit {
  // Allow 4tlas.pages.dev and all deployment preview URLs (*.4tlas.pages.dev)
  const isAllowed = origin && (
    origin === 'https://4tlas.pages.dev' ||
    origin.endsWith('.4tlas.pages.dev') ||
    origin === 'http://localhost:5173' ||
    origin === 'http://localhost:4173'
  );

  const allowOrigin = isAllowed ? origin : 'https://4tlas.pages.dev';

  return {
    'Access-Control-Allow-Origin': allowOrigin!,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-4TLAS-Key',
    'Access-Control-Max-Age': '86400',
  };
}

// JSON response helper
function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get('origin');
    const ua = request.headers.get('user-agent') ?? '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Block bots from API routes
    if (path.startsWith('/api/') && (BOT_UA.test(ua) || !ua || ua.length < 10)) {
      return json({ error: 'Forbidden' }, 403, corsHeaders(origin));
    }

    // Route handling
    try {
      // Root landing page
      if (path === '/' || path === '') {
        return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>World Monitor API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 600px;
    }
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d4ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 16px;
    }
    .subtitle {
      color: #888;
      font-size: 1.1rem;
      margin-bottom: 32px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 255, 136, 0.1);
      border: 1px solid rgba(0, 255, 136, 0.3);
      padding: 8px 16px;
      border-radius: 20px;
      color: #00ff88;
      font-size: 0.9rem;
      margin-bottom: 32px;
    }
    .status::before {
      content: '';
      width: 8px;
      height: 8px;
      background: #00ff88;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .endpoints {
      text-align: left;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      margin-top: 24px;
    }
    .endpoints h3 {
      color: #888;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .endpoint {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
      color: #00d4ff;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .endpoint:last-child { border: none; }
    .endpoint span { color: #888; }
    a { color: inherit; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>World Monitor API</h1>
    <p class="subtitle">Real-time Global Intelligence API powered by Cloudflare Workers</p>
    <div class="status">Operational</div>
    <div class="endpoints">
      <h3>Available Endpoints</h3>
      <div class="endpoint"><a href="/api/health">GET /api/health</a> <span>- Health check</span></div>
      <div class="endpoint"><a href="/api/version">GET /api/version</a> <span>- Version info</span></div>
      <div class="endpoint"><a href="/api/cache-test">GET /api/cache-test</a> <span>- KV cache test</span></div>
      <div class="endpoint">POST /api/news/v1/summarize-article <span>- AI summarization</span></div>
    </div>
  </div>
</body>
</html>
        `.trim(), {
          status: 200,
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      // Health check
      if (path === '/api/health') {
        return json({
          status: 'ok',
          timestamp: Date.now(),
          env: env.ENVIRONMENT,
        }, 200, corsHeaders(origin));
      }

      // Version endpoint
      if (path === '/api/version') {
        return json({
          version: '2.5.25',
          runtime: 'cloudflare-workers',
        }, 200, corsHeaders(origin));
      }

      // KV cache test endpoint
      if (path === '/api/cache-test') {
        const testKey = 'test:ping';
        const cached = await env.CACHE.get(testKey);

        if (cached) {
          return json({ source: 'cache', value: cached }, 200, corsHeaders(origin));
        }

        const value = `pong-${Date.now()}`;
        await env.CACHE.put(testKey, value, { expirationTtl: 60 });
        return json({ source: 'fresh', value }, 200, corsHeaders(origin));
      }

      // AI Summarization endpoint (Azure AI Foundry)
      if (path === '/api/news/v1/summarize-article' && request.method === 'POST') {
        if (!env.AZURE_AI_ENDPOINT || !env.AZURE_AI_KEY) {
          return json({
            summary: '',
            model: '',
            provider: 'azure',
            tokens: 0,
            fallback: true,
            error: '',
            errorType: '',
            status: 'SUMMARIZE_STATUS_SKIPPED',
            statusDetail: 'AZURE_AI_ENDPOINT or AZURE_AI_KEY not configured',
          }, 200, corsHeaders(origin));
        }

        try {
          const body = await request.json() as {
            provider?: string;
            headlines?: string[];
            mode?: string;
            geoContext?: string;
            variant?: string;
            lang?: string;
          };

          const headlines = (body.headlines || []).slice(0, 10);
          if (!headlines.length) {
            return json({
              summary: '',
              model: '',
              provider: 'azure',
              tokens: 0,
              fallback: false,
              error: 'Headlines array required',
              errorType: 'ValidationError',
              status: 'SUMMARIZE_STATUS_ERROR',
              statusDetail: 'Headlines array required',
            }, 200, corsHeaders(origin));
          }

          const mode = body.mode || 'brief';
          const lang = body.lang || 'en';
          const variant = body.variant || 'full';
          const isTech = variant === 'tech';
          const dateContext = `Current date: ${new Date().toISOString().split('T')[0]}.`;
          const langInstruction = lang !== 'en' ? `\nIMPORTANT: Output the summary in ${lang.toUpperCase()} language.` : '';

          const headlineText = headlines.slice(0, 5).map((h: string, i: number) => `${i + 1}. ${h.slice(0, 500)}`).join('\n');

          const systemPrompt = isTech
            ? `${dateContext}\n\nSummarize the single most important tech/startup headline in 2 concise sentences MAX (under 60 words total).\nRules:\n- Each numbered headline below is a SEPARATE, UNRELATED story\n- Pick the ONE most significant headline and summarize ONLY that story\n- NEVER combine or merge facts, names, or details from different headlines\n- Focus ONLY on technology, startups, AI, funding, product launches, or developer news\n- Lead with the company/product/technology name\n- No bullet points, no meta-commentary${langInstruction}`
            : `${dateContext}\n\nSummarize the single most important headline in 2 concise sentences MAX (under 60 words total).\nRules:\n- Each numbered headline below is a SEPARATE, UNRELATED story\n- Pick the ONE most significant headline and summarize ONLY that story\n- NEVER combine or merge people, places, or facts from different headlines\n- Lead with WHAT happened and WHERE - be specific\n- NEVER start with "Breaking news", "Good evening", "Tonight"\n- No bullet points, no meta-commentary${langInstruction}`;

          const userPrompt = `Each headline below is a separate story. Pick the most important ONE and summarize only that story:\n${headlineText}`;

          // Check cache first
          const cacheKey = `summary:${btoa(headlines.slice(0, 5).join('|')).slice(0, 100)}:${mode}:${lang}`;
          const cachedSummary = await env.CACHE.get(cacheKey);
          if (cachedSummary) {
            return json({
              summary: cachedSummary,
              model: 'gpt-4o-mini',
              provider: 'cache',
              tokens: 0,
              fallback: false,
              error: '',
              errorType: '',
              status: 'SUMMARIZE_STATUS_CACHED',
              statusDetail: '',
            }, 200, corsHeaders(origin));
          }

          // Call Azure AI
          const aiResponse = await fetch(env.AZURE_AI_ENDPOINT, {
            method: 'POST',
            headers: {
              'api-key': env.AZURE_AI_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.3,
              max_completion_tokens: 100,
              top_p: 0.9,
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error('Azure AI error:', aiResponse.status, errorText);
            return json({
              summary: '',
              model: '',
              provider: 'azure',
              tokens: 0,
              fallback: true,
              error: aiResponse.status === 429 ? 'Rate limited' : 'Azure AI error',
              errorType: 'APIError',
              status: 'SUMMARIZE_STATUS_ERROR',
              statusDetail: `HTTP ${aiResponse.status}`,
            }, 200, corsHeaders(origin));
          }

          const aiData = await aiResponse.json() as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { total_tokens?: number };
          };
          const tokens = aiData.usage?.total_tokens || 0;
          let summary = aiData.choices?.[0]?.message?.content?.trim() || '';

          // Strip thinking tags
          summary = summary
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
            .trim();

          if (!summary || summary.length < 20) {
            return json({
              summary: '',
              model: 'gpt-4o-mini',
              provider: 'azure',
              tokens,
              fallback: true,
              error: 'Empty or too short response',
              errorType: '',
              status: 'SUMMARIZE_STATUS_ERROR',
              statusDetail: 'Empty or too short response',
            }, 200, corsHeaders(origin));
          }

          // Cache the result
          ctx.waitUntil(env.CACHE.put(cacheKey, summary, { expirationTtl: 86400 }));

          return json({
            summary,
            model: 'gpt-4o-mini',
            provider: 'azure',
            tokens,
            fallback: false,
            error: '',
            errorType: '',
            status: 'SUMMARIZE_STATUS_SUCCESS',
            statusDetail: '',
          }, 200, corsHeaders(origin));

        } catch (err) {
          console.error('Summarization error:', err);
          return json({
            summary: '',
            model: '',
            provider: 'azure',
            tokens: 0,
            fallback: true,
            error: String(err),
            errorType: 'Error',
            status: 'SUMMARIZE_STATUS_ERROR',
            statusDetail: String(err),
          }, 200, corsHeaders(origin));
        }
      }

      // Relay proxy - forwards API requests to Heroku relay
      // Maps Vercel API routes to relay endpoints
      if (path.startsWith('/api/')) {
        // Path mappings from Vercel API routes to relay endpoints
        const pathMappings: Record<string, string> = {
          '/api/telegram-feed': '/telegram/feed',
          '/api/opensky': '/opensky',
          '/api/oref-alerts': '/oref/alerts',
          '/api/ais-snapshot': '/ais/snapshot',
          '/api/rss-proxy': '/rss',
          '/api/polymarket': '/polymarket',
          '/api/youtube-live': '/youtube-live',
          '/api/yahoo-chart': '/yahoo-chart',
          '/api/worldbank': '/worldbank',
          '/api/ucdp-events': '/ucdp-events',
        };

        // Check for exact match or prefix match
        let relayPath: string | null = null;

        // Check /api/relay/* passthrough
        if (path.startsWith('/api/relay/')) {
          relayPath = path.replace('/api/relay', '');
        } else {
          // Check path mappings
          for (const [apiPath, mappedPath] of Object.entries(pathMappings)) {
            if (path === apiPath || path.startsWith(apiPath + '/') || path.startsWith(apiPath + '?')) {
              relayPath = path.replace(apiPath, mappedPath);
              break;
            }
          }
        }

        if (relayPath && env.HEROKU_RELAY_URL) {
          const relayUrl = `${env.HEROKU_RELAY_URL}${relayPath}${url.search}`;

          try {
            const relayResponse = await fetch(relayUrl, {
              method: request.method,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-relay-key': env.RELAY_SHARED_SECRET || '',
                'Authorization': `Bearer ${env.RELAY_SHARED_SECRET || ''}`,
              },
            });

            const contentType = relayResponse.headers.get('content-type') || 'application/json';
            const body = await relayResponse.text();

            return new Response(body, {
              status: relayResponse.status,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=30',
                ...corsHeaders(origin),
              },
            });
          } catch (err) {
            return json({ error: 'Relay request failed', details: String(err) }, 502, corsHeaders(origin));
          }
        }

        // 404 for unknown API routes
        return json({ error: 'Not found' }, 404, corsHeaders(origin));
      }

      // For non-API routes, this worker shouldn't handle them
      // They should be served by Cloudflare Pages
      return json({ error: 'Route not handled by worker' }, 404);

    } catch (err) {
      console.error('Worker error:', err);
      return json(
        { error: 'Internal server error' },
        500,
        corsHeaders(origin)
      );
    }
  },
};
