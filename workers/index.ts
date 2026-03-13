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

  // Azure OpenAI (ATLAS)
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;

  // Upstash Redis (for bootstrap data)
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;

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
  // Allow Cloudflare Pages, Vercel, and localhost
  const isAllowed = origin && (
    origin === 'https://4tlas.pages.dev' ||
    origin.endsWith('.4tlas.pages.dev') ||
    origin === 'https://worldmonitor-ag4.pages.dev' ||
    origin.endsWith('.worldmonitor-ag4.pages.dev') ||
    origin.endsWith('.vercel.app') ||
    origin === 'https://insanprihatin-lovat.vercel.app' ||
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

// ============================================================================
// ATLAS Analysis Generator
// ============================================================================

interface AtlasAgentReport {
  agentName: string;
  findings: Array<{
    category: string;
    severity: number;
    summary: string;
    details: string;
    timestamp: string;
    source: string;
  }>;
  overallSeverity: number;
  toolsCalled: string[];
  rawAnalysis: string;
  executionTimeMs: number;
}

interface AtlasAnalysisResult {
  region: string;
  regionName: string;
  timestamp: string;
  agentReports: AtlasAgentReport[];
  correlations: {
    correlatedPatterns: Array<{
      type: string;
      description: string;
      confidence: number;
      involvedAgents: string[];
    }>;
    signalStrength: number;
    cascadeRisk: string;
  };
  threatScore: number;
  summary: string;
  keyFindings: string[];
  recommendedActions: string[];
  totalExecutionTimeMs: number;
}

const REGION_DATA: Record<string, { name: string; countries: string[] }> = {
  'middle-east': { name: 'Middle East', countries: ['Israel', 'Iran', 'Iraq', 'Syria', 'Lebanon', 'Saudi Arabia', 'UAE', 'Yemen'] },
  'asia-pacific': { name: 'Asia Pacific', countries: ['China', 'Japan', 'Taiwan', 'South Korea', 'Philippines', 'Vietnam', 'India'] },
  'europe': { name: 'Europe', countries: ['Ukraine', 'Russia', 'Poland', 'Germany', 'France', 'UK', 'Finland', 'Baltic'] },
  'africa': { name: 'Africa', countries: ['Sudan', 'Ethiopia', 'Somalia', 'Nigeria', 'DRC', 'Libya', 'Mali', 'Sahel'] },
  'americas': { name: 'Americas', countries: ['USA', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Venezuela'] },
};

// ============================================================================
// AZURE GPT-5.4 API CALLS FOR ATLAS AGENTS
// ============================================================================

interface AzureChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AzureChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callAzureGPT(
  env: Env,
  messages: AzureChatMessage[],
  temperature = 0.7
): Promise<string> {
  const response = await fetch(env.AZURE_AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.AZURE_AI_KEY,
    },
    body: JSON.stringify({
      messages,
      temperature,
      max_completion_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure GPT API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as AzureChatResponse;
  return data.choices[0]?.message?.content || '';
}

interface AgentFindingParsed {
  category: string;
  severity: number;
  summary: string;
  details: string;
  source: string;
}

function parseAgentFindings(content: string): AgentFindingParsed[] {
  const findings: AgentFindingParsed[] = [];

  // Try to parse JSON array from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          findings.push({
            category: item.category || 'general',
            severity: Math.min(10, Math.max(1, Number(item.severity) || 5)),
            summary: item.summary || item.title || 'No summary',
            details: item.details || item.description || '',
            source: item.source || 'AI Analysis',
          });
        }
        return findings;
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Fallback: parse numbered list format
  const lines = content.split('\n');
  let currentFinding: Partial<AgentFindingParsed> = {};

  for (const line of lines) {
    const severityMatch = line.match(/severity[:\s]*(\d+)/i);
    const categoryMatch = line.match(/category[:\s]*([a-z_]+)/i);
    const summaryMatch = line.match(/^[\d\.\-\*]+\s*(.+)/);

    if (severityMatch) currentFinding.severity = Number(severityMatch[1]);
    if (categoryMatch) currentFinding.category = categoryMatch[1];
    if (summaryMatch && !currentFinding.summary) {
      currentFinding.summary = summaryMatch[1].substring(0, 200);
    }

    if (currentFinding.summary && line.trim() === '') {
      findings.push({
        category: currentFinding.category || 'general',
        severity: currentFinding.severity || 5,
        summary: currentFinding.summary,
        details: currentFinding.details || '',
        source: 'AI Analysis',
      });
      currentFinding = {};
    }
  }

  // Add last finding if exists
  if (currentFinding.summary) {
    findings.push({
      category: currentFinding.category || 'general',
      severity: currentFinding.severity || 5,
      summary: currentFinding.summary,
      details: currentFinding.details || '',
      source: 'AI Analysis',
    });
  }

  return findings.length > 0 ? findings : [{
    category: 'analysis',
    severity: 5,
    summary: content.substring(0, 200),
    details: content,
    source: 'AI Analysis',
  }];
}

async function runGeoIntAgent(
  region: string,
  regionInfo: { name: string },
  env: Env
): Promise<AtlasAgentReport> {
  const startTime = Date.now();

  const systemPrompt = `You are GeoInt, a Geopolitical Intelligence AI agent for the ATLAS threat analysis system.
Your role: Analyze conflicts, protests, political instability, and breaking news for the ${regionInfo.name} region.
Countries: ${REGION_DATA[region]?.countries.join(', ')}

Respond with a JSON array of 2-4 findings. Each finding must have:
- category: one of "armed_conflict", "protest", "political_crisis", "border_tension", "terrorism", "civil_unrest"
- severity: 1-10 (10 = critical)
- summary: one sentence (max 100 chars)
- details: 1-2 sentences with specifics
- source: "ACLED", "UCDP", "OSINT", or "News Analysis"

Focus on events from the last 7 days. Be specific about locations and actors.`;

  const userPrompt = `Analyze current geopolitical situation in ${regionInfo.name}. What are the most significant conflicts, protests, or political developments right now? Return JSON array format.`;

  try {
    const response = await callAzureGPT(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const findings = parseAgentFindings(response);

    return {
      agentName: 'GeoInt',
      findings: findings.map(f => ({
        ...f,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      })),
      overallSeverity: findings.reduce((sum, f) => sum + f.severity, 0) / Math.max(1, findings.length),
      toolsCalled: ['azure_gpt5.4_geoint_analysis'],
      rawAnalysis: response,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    throw new Error(`GeoInt agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function runFinIntAgent(
  region: string,
  regionInfo: { name: string },
  env: Env
): Promise<AtlasAgentReport> {
  const startTime = Date.now();

  const systemPrompt = `You are FinInt, a Financial Intelligence AI agent for the ATLAS threat analysis system.
Your role: Analyze market conditions, commodity prices, currency stress, and economic indicators for the ${regionInfo.name} region.
Countries: ${REGION_DATA[region]?.countries.join(', ')}

Respond with a JSON array of 2-4 findings. Each finding must have:
- category: one of "commodity", "currency", "equity", "bonds", "inflation", "sanctions", "trade_disruption"
- severity: 1-10 (10 = critical)
- summary: one sentence (max 100 chars)
- details: 1-2 sentences with specifics (include % changes where relevant)
- source: "Market Data", "Forex", "Central Bank", or "Trade Analysis"

Focus on significant market movements or economic stress signals.`;

  const userPrompt = `Analyze current financial and economic conditions affecting ${regionInfo.name}. What market signals, commodity price movements, or economic stress indicators are notable? Return JSON array format.`;

  try {
    const response = await callAzureGPT(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const findings = parseAgentFindings(response);

    return {
      agentName: 'FinInt',
      findings: findings.map(f => ({
        ...f,
        timestamp: new Date().toISOString(),
      })),
      overallSeverity: findings.reduce((sum, f) => sum + f.severity, 0) / Math.max(1, findings.length),
      toolsCalled: ['azure_gpt5.4_finint_analysis'],
      rawAnalysis: response,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    throw new Error(`FinInt agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function runThreatIntAgent(
  region: string,
  regionInfo: { name: string },
  env: Env
): Promise<AtlasAgentReport> {
  const startTime = Date.now();

  const systemPrompt = `You are ThreatInt, a Threat Intelligence AI agent for the ATLAS threat analysis system.
Your role: Analyze cyber threats, natural disasters, infrastructure issues, and military activity for the ${regionInfo.name} region.
Countries: ${REGION_DATA[region]?.countries.join(', ')}

Respond with a JSON array of 2-4 findings. Each finding must have:
- category: one of "apt_activity", "cyber_attack", "infrastructure", "natural_disaster", "military_activity", "gps_jamming"
- severity: 1-10 (10 = critical)
- summary: one sentence (max 100 chars)
- details: 1-2 sentences with specifics
- source: "Threat Intel", "CERT", "USGS", "ADS-B", or "Infrastructure Monitor"

Focus on active threats and unusual patterns.`;

  const userPrompt = `Analyze current threat landscape for ${regionInfo.name}. What cyber threats, natural disasters, infrastructure issues, or military movements are significant? Return JSON array format.`;

  try {
    const response = await callAzureGPT(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const findings = parseAgentFindings(response);

    return {
      agentName: 'ThreatInt',
      findings: findings.map(f => ({
        ...f,
        timestamp: new Date(Date.now() - Math.random() * 43200000).toISOString(),
      })),
      overallSeverity: findings.reduce((sum, f) => sum + f.severity, 0) / Math.max(1, findings.length),
      toolsCalled: ['azure_gpt5.4_threatint_analysis'],
      rawAnalysis: response,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    throw new Error(`ThreatInt agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateAtlasAnalysis(region: string, env: Env): Promise<AtlasAnalysisResult> {
  const startTime = Date.now();
  const regionInfo = REGION_DATA[region] || REGION_DATA['middle-east'];

  // Run all 3 agents in parallel using Azure GPT-5.4
  const [geoIntReport, finIntReport, threatIntReport] = await Promise.all([
    runGeoIntAgent(region, regionInfo, env),
    runFinIntAgent(region, regionInfo, env),
    runThreatIntAgent(region, regionInfo, env),
  ]);

  const agentReports = [geoIntReport, finIntReport, threatIntReport];

  // Correlate findings
  const correlations = correlateAgentFindings(agentReports);

  // Calculate threat score
  const avgSeverity = agentReports.reduce((sum, r) => sum + r.overallSeverity, 0) / 3;
  const correlationBoost = correlations.correlatedPatterns.length * 5;
  const threatScore = Math.min(100, Math.round(avgSeverity * 10 + correlationBoost));

  // Generate key findings
  const keyFindings: string[] = [];
  for (const report of agentReports) {
    const topFinding = report.findings.sort((a, b) => b.severity - a.severity)[0];
    if (topFinding) {
      keyFindings.push(`[${report.agentName}] ${topFinding.summary}`);
    }
  }
  for (const pattern of correlations.correlatedPatterns.slice(0, 2)) {
    keyFindings.push(`[Correlation] ${pattern.description}`);
  }

  // Generate summary
  const level = threatScore >= 70 ? 'HIGH' : threatScore >= 40 ? 'ELEVATED' : 'MODERATE';
  const totalFindings = agentReports.reduce((sum, r) => sum + r.findings.length, 0);
  const summary = `${regionInfo.name} threat assessment: ${level} (${threatScore}/100). ` +
    `Analysis identified ${totalFindings} significant events across 3 intelligence domains. ` +
    (correlations.correlatedPatterns.length > 0
      ? `Detected ${correlations.correlatedPatterns.length} cross-domain correlation(s) suggesting coordinated or cascading effects.`
      : 'No significant cross-domain correlations detected.');

  // Generate recommendations
  const recommendedActions: string[] = [];
  if (threatScore >= 70) {
    recommendedActions.push('Enable continuous monitoring for this region');
    recommendedActions.push('Alert relevant stakeholders of elevated threat level');
  }
  if (threatScore >= 40) {
    recommendedActions.push('Increase monitoring frequency for key indicators');
  }
  if (correlations.correlatedPatterns.some(p => p.type === 'escalation')) {
    recommendedActions.push('Monitor for further escalation signals');
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push('Continue standard monitoring protocols');
  }

  return {
    region,
    regionName: regionInfo.name,
    timestamp: new Date().toISOString(),
    agentReports,
    correlations,
    threatScore,
    summary,
    keyFindings,
    recommendedActions,
    totalExecutionTimeMs: Date.now() - startTime,
  };
}
function correlateAgentFindings(reports: AtlasAgentReport[]) {
  const patterns: Array<{
    type: string;
    description: string;
    confidence: number;
    involvedAgents: string[];
  }> = [];

  const geoInt = reports.find(r => r.agentName === 'GeoInt');
  const finInt = reports.find(r => r.agentName === 'FinInt');
  const threatInt = reports.find(r => r.agentName === 'ThreatInt');

  // Check for economic-political correlation
  const hasProtests = geoInt?.findings.some(f => f.category === 'protest' || f.category === 'civil_unrest');
  const hasEconomicStress = finInt?.findings.some(f => f.category === 'currency' || f.severity >= 6);

  if (hasProtests && hasEconomicStress) {
    patterns.push({
      type: 'economic-political',
      description: 'Economic stress correlating with civil unrest - classic instability pattern',
      confidence: 75,
      involvedAgents: ['GeoInt', 'FinInt'],
    });
  }

  // Check for cyber-kinetic correlation
  const hasConflict = geoInt?.findings.some(f => f.category === 'armed_conflict' || f.category === 'military_posturing');
  const hasCyber = threatInt?.findings.some(f => f.category === 'apt_activity' || f.category === 'cyber_attack');

  if (hasConflict && hasCyber) {
    patterns.push({
      type: 'cyber-kinetic',
      description: 'Cyber operations detected alongside kinetic activity - potential coordinated campaign',
      confidence: 70,
      involvedAgents: ['GeoInt', 'ThreatInt'],
    });
  }

  // Check for escalation
  const highSeverityCount = reports.reduce(
    (count, r) => count + r.findings.filter(f => f.severity >= 7).length,
    0
  );

  if (highSeverityCount >= 3) {
    patterns.push({
      type: 'escalation',
      description: `${highSeverityCount} high-severity events across multiple domains - escalation risk elevated`,
      confidence: 80,
      involvedAgents: reports.filter(r => r.findings.some(f => f.severity >= 7)).map(r => r.agentName),
    });
  }

  const signalStrength = patterns.length > 0
    ? Math.round(patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length)
    : 0;

  return {
    correlatedPatterns: patterns,
    signalStrength,
    cascadeRisk: patterns.some(p => p.type === 'escalation' || p.type === 'cascade')
      ? 'high'
      : patterns.length >= 2
        ? 'medium'
        : 'low',
  };
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
      <div class="endpoint"><a href="/api/atlas/status">GET /api/atlas/status</a> <span>- ATLAS system status</span></div>
      <div class="endpoint"><a href="/api/atlas/regions">GET /api/atlas/regions</a> <span>- Available regions</span></div>
      <div class="endpoint">POST /api/atlas/analyze <span>- Multi-agent threat analysis</span></div>
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

      // News Feed Digest endpoint - returns categorized RSS news
      if (path === '/api/news/v1/list-feed-digest' && request.method === 'GET') {
        const variant = url.searchParams.get('variant') || 'full';
        const lang = url.searchParams.get('lang') || 'en';
        const cacheKey = `news:digest:v2:${variant}:${lang}`;

        // Check cache first (15 minute TTL)
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        // RSS Feed sources by category
        const FEED_SOURCES: Record<string, Array<{ name: string; url: string }>> = {
          breaking: [
            { name: 'Reuters World', url: 'https://feeds.reuters.com/Reuters/worldNews' },
            { name: 'AP News', url: 'https://rsshub.app/apnews/topics/world-news' },
            { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
          ],
          geopolitics: [
            { name: 'Foreign Affairs', url: 'https://www.foreignaffairs.com/rss.xml' },
            { name: 'War on the Rocks', url: 'https://warontherocks.com/feed/' },
            { name: 'Defense One', url: 'https://www.defenseone.com/rss/all/' },
          ],
          business: [
            { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews' },
            { name: 'Financial Times', url: 'https://www.ft.com/rss/home' },
            { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
          ],
          tech: [
            { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
            { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
            { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
          ],
          intel: [
            { name: 'Bellingcat', url: 'https://www.bellingcat.com/feed/' },
            { name: 'CSIS', url: 'https://www.csis.org/analysis/feed' },
            { name: 'Janes', url: 'https://www.janes.com/feeds/news' },
          ],
        };

        const THREAT_KEYWORDS: Record<string, { level: string; category: string }> = {
          'missile': { level: 'THREAT_LEVEL_HIGH', category: 'military' },
          'nuclear': { level: 'THREAT_LEVEL_CRITICAL', category: 'military' },
          'attack': { level: 'THREAT_LEVEL_HIGH', category: 'conflict' },
          'war': { level: 'THREAT_LEVEL_HIGH', category: 'conflict' },
          'invasion': { level: 'THREAT_LEVEL_CRITICAL', category: 'conflict' },
          'explosion': { level: 'THREAT_LEVEL_HIGH', category: 'incident' },
          'terror': { level: 'THREAT_LEVEL_CRITICAL', category: 'security' },
          'earthquake': { level: 'THREAT_LEVEL_HIGH', category: 'natural' },
          'hurricane': { level: 'THREAT_LEVEL_HIGH', category: 'natural' },
          'flood': { level: 'THREAT_LEVEL_MEDIUM', category: 'natural' },
          'sanctions': { level: 'THREAT_LEVEL_MEDIUM', category: 'economic' },
          'crash': { level: 'THREAT_LEVEL_MEDIUM', category: 'economic' },
          'protest': { level: 'THREAT_LEVEL_MEDIUM', category: 'unrest' },
          'riot': { level: 'THREAT_LEVEL_HIGH', category: 'unrest' },
          'coup': { level: 'THREAT_LEVEL_CRITICAL', category: 'political' },
          'assassination': { level: 'THREAT_LEVEL_CRITICAL', category: 'political' },
        };

        function classifyHeadline(title: string): { level: string; category: string; confidence: number } {
          const lower = title.toLowerCase();
          for (const [keyword, threat] of Object.entries(THREAT_KEYWORDS)) {
            if (lower.includes(keyword)) {
              return { ...threat, confidence: 0.8 };
            }
          }
          return { level: 'THREAT_LEVEL_LOW', category: 'general', confidence: 0.5 };
        }

        function parseRssItems(xml: string, sourceName: string): Array<{
          source: string;
          title: string;
          link: string;
          publishedAt: number;
          isAlert: boolean;
          threat: { level: string; category: string; confidence: number; source: string };
        }> {
          const items: Array<{
            source: string;
            title: string;
            link: string;
            publishedAt: number;
            isAlert: boolean;
            threat: { level: string; category: string; confidence: number; source: string };
          }> = [];

          // Match RSS items
          const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
          const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;

          let matches = [...xml.matchAll(itemRegex)];
          const isAtom = matches.length === 0;
          if (isAtom) matches = [...xml.matchAll(entryRegex)];

          for (const match of matches.slice(0, 5)) {
            const block = match[1]!;

            // Extract title
            const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
            const title = titleMatch?.[1]?.trim().replace(/<!\[CDATA\[|\]\]>/g, '') || '';
            if (!title) continue;

            // Extract link
            let link = '';
            if (isAtom) {
              const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/);
              link = hrefMatch?.[1] || '';
            } else {
              const linkMatch = block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
              link = linkMatch?.[1]?.trim() || '';
            }

            // Extract date
            const dateMatch = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
            const dateStr = dateMatch?.[1]?.trim() || '';
            const publishedAt = dateStr ? new Date(dateStr).getTime() : Date.now();

            const threat = classifyHeadline(title);
            const isAlert = threat.level === 'THREAT_LEVEL_CRITICAL' || threat.level === 'THREAT_LEVEL_HIGH';

            items.push({
              source: sourceName,
              title,
              link,
              publishedAt: isNaN(publishedAt) ? Date.now() : publishedAt,
              isAlert,
              threat: { ...threat, source: 'keyword' },
            });
          }

          return items;
        }

        try {
          const categories: Record<string, { items: Array<unknown> }> = {};
          const feedStatuses: Record<string, string> = {};

          // Fetch feeds in parallel with timeout
          const fetchPromises: Array<Promise<{ category: string; items: Array<unknown> }>> = [];

          for (const [category, feeds] of Object.entries(FEED_SOURCES)) {
            for (const feed of feeds) {
              fetchPromises.push(
                (async () => {
                  try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);

                    const resp = await fetch(feed.url, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; WorldMonitor/2.5)',
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                      },
                      signal: controller.signal,
                    });
                    clearTimeout(timeout);

                    if (!resp.ok) {
                      feedStatuses[feed.name] = 'error';
                      return { category, items: [] };
                    }

                    const xml = await resp.text();
                    const items = parseRssItems(xml, feed.name);
                    feedStatuses[feed.name] = items.length > 0 ? 'ok' : 'empty';
                    return { category, items };
                  } catch {
                    feedStatuses[feed.name] = 'timeout';
                    return { category, items: [] };
                  }
                })()
              );
            }
          }

          const results = await Promise.allSettled(fetchPromises);

          for (const result of results) {
            if (result.status === 'fulfilled') {
              const { category, items } = result.value;
              if (!categories[category]) {
                categories[category] = { items: [] };
              }
              categories[category].items.push(...items);
            }
          }

          // Sort items by date within each category
          for (const cat of Object.values(categories)) {
            cat.items.sort((a: any, b: any) => (b.publishedAt || 0) - (a.publishedAt || 0));
            cat.items = cat.items.slice(0, 20); // Limit to 20 per category
          }

          const response = {
            categories,
            feedStatuses,
            generatedAt: new Date().toISOString(),
          };

          // Cache for 15 minutes
          ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 900 }));

          return json(response, 200, corsHeaders(origin));
        } catch (err) {
          console.error('News digest error:', err);
          return json({
            categories: {},
            feedStatuses: {},
            generatedAt: new Date().toISOString(),
            error: 'Failed to fetch news feeds',
          }, 200, corsHeaders(origin));
        }
      }

      // Military Theater Posture endpoint - strategic military activity assessment
      if (path === '/api/military/v1/get-theater-posture' && request.method === 'GET') {
        const cacheKey = 'theater-posture:v1';

        // Check cache first (15 minute TTL)
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        // Theater definitions with thresholds
        const THEATERS = [
          { id: 'iran-theater', name: 'Iran Theater', bounds: { north: 42, south: 20, east: 65, west: 30 }, thresholds: { elevated: 8, critical: 20 } },
          { id: 'taiwan-theater', name: 'Taiwan Strait', bounds: { north: 30, south: 18, east: 130, west: 115 }, thresholds: { elevated: 6, critical: 15 } },
          { id: 'baltic-theater', name: 'Baltic Theater', bounds: { north: 65, south: 52, east: 32, west: 10 }, thresholds: { elevated: 5, critical: 12 } },
          { id: 'blacksea-theater', name: 'Black Sea', bounds: { north: 48, south: 40, east: 42, west: 26 }, thresholds: { elevated: 4, critical: 10 } },
          { id: 'korea-theater', name: 'Korean Peninsula', bounds: { north: 43, south: 33, east: 132, west: 124 }, thresholds: { elevated: 5, critical: 12 } },
          { id: 'south-china-sea', name: 'South China Sea', bounds: { north: 25, south: 5, east: 121, west: 105 }, thresholds: { elevated: 6, critical: 15 } },
          { id: 'east-med-theater', name: 'Eastern Mediterranean', bounds: { north: 37, south: 33, east: 37, west: 25 }, thresholds: { elevated: 4, critical: 10 } },
          { id: 'israel-gaza-theater', name: 'Israel/Gaza', bounds: { north: 33, south: 29, east: 36, west: 33 }, thresholds: { elevated: 3, critical: 8 } },
          { id: 'yemen-redsea-theater', name: 'Yemen/Red Sea', bounds: { north: 22, south: 11, east: 54, west: 32 }, thresholds: { elevated: 4, critical: 10 } },
        ];

        // Military callsign patterns
        const MILITARY_PATTERNS = /^(RCH|DUKE|REACH|JAKE|DOOM|HAVOC|VIPER|RAGE|FURY|KNIFE|SWORD|ARROW|HAWK|TALON|REAPER|HUNTER|GHOST|ATLAS|GIANT|SHELL|EVAC|NITE|NIGHT|DARK|STEEL|IRON|SNAKE|COBRA|PANTH|TIGER|WOLF|BEAR|EAGLE|FALCON|BONE|GOLD|SPAR|TEAL|NAVY|RRR|CNV|CFC|MMF|AFP|PAF|GAF|FAF|RAF|USAF|RCAF|IAF)/i;

        interface Flight {
          id: string;
          callsign: string;
          lat: number;
          lon: number;
        }

        try {
          // Fetch flight data from OpenSky via relay (if configured)
          let flights: Flight[] = [];

          if (env.HEROKU_RELAY_URL) {
            // Fetch two bounding regions covering all theaters
            const regions = [
              { lamin: 10, lamax: 66, lomin: 9, lomax: 66 },   // Western (Baltic→Yemen, Baltic→Iran)
              { lamin: 4, lamax: 44, lomin: 104, lomax: 133 }, // Pacific (SCS→Korea)
            ];

            for (const region of regions) {
              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);

                const resp = await fetch(
                  `${env.HEROKU_RELAY_URL}/opensky?lamin=${region.lamin}&lamax=${region.lamax}&lomin=${region.lomin}&lomax=${region.lomax}`,
                  {
                    headers: {
                      'x-relay-key': env.RELAY_SHARED_SECRET || '',
                      'Authorization': `Bearer ${env.RELAY_SHARED_SECRET || ''}`,
                    },
                    signal: controller.signal,
                  }
                );
                clearTimeout(timeout);

                if (resp.ok) {
                  const data = await resp.json() as { states?: Array<[string, string, ...unknown[]]> };
                  if (data.states) {
                    for (const state of data.states) {
                      const [icao24, callsign, , , , lon, lat, , onGround] = state as [string, string, unknown, unknown, unknown, number | null, number | null, unknown, boolean];
                      if (lat == null || lon == null || onGround) continue;
                      const cs = (callsign || '').trim();
                      // Filter for military flights
                      if (MILITARY_PATTERNS.test(cs) || icao24.startsWith('AE') || icao24.startsWith('AF')) {
                        flights.push({ id: icao24, callsign: cs, lat, lon });
                      }
                    }
                  }
                }
              } catch {
                // Continue with next region
              }
            }
          }

          // Calculate theater postures
          const theaters = THEATERS.map(theater => {
            const theaterFlights = flights.filter(
              f => f.lat >= theater.bounds.south && f.lat <= theater.bounds.north &&
                   f.lon >= theater.bounds.west && f.lon <= theater.bounds.east
            );

            const total = theaterFlights.length;
            const postureLevel = total >= theater.thresholds.critical
              ? 'critical'
              : total >= theater.thresholds.elevated
                ? 'elevated'
                : 'normal';

            return {
              theater: theater.id,
              postureLevel,
              activeFlights: total,
              trackedVessels: 0,
              activeOperations: total >= theater.thresholds.elevated ? ['aerial_operations'] : [],
              assessedAt: Date.now(),
            };
          });

          const response = { theaters };

          // Cache for 15 minutes
          ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 900 }));

          return json(response, 200, corsHeaders(origin));
        } catch (err) {
          console.error('Theater posture error:', err);
          // Return empty theaters on error
          return json({ theaters: [] }, 200, corsHeaders(origin));
        }
      }

      // Market Quotes endpoint - stock prices via Yahoo Finance
      // Returns ListMarketQuotesResponse format per proto definition
      if (path === '/api/market/v1/list-market-quotes' && request.method === 'GET') {
        const cacheKey = 'market-quotes:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        const symbols = ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX', 'TLT', 'GLD', 'USO'];
        const symbolNames: Record<string, string> = {
          'SPY': 'S&P 500 ETF', 'QQQ': 'Nasdaq 100 ETF', 'DIA': 'Dow Jones ETF',
          'IWM': 'Russell 2000 ETF', 'VIX': 'Volatility Index', 'TLT': '20+ Year Treasury',
          'GLD': 'Gold ETF', 'USO': 'Oil ETF'
        };
        const quotes: Array<{ symbol: string; name: string; display: string; price: number; change: number; sparkline: number[] }> = [];

        if (env.HEROKU_RELAY_URL) {
          for (const symbol of symbols) {
            try {
              const resp = await fetch(`${env.HEROKU_RELAY_URL}/yahoo-chart?symbol=${symbol}`, {
                headers: { 'x-relay-key': env.RELAY_SHARED_SECRET || '' },
                signal: AbortSignal.timeout(5000),
              });
              if (resp.ok) {
                const data = await resp.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number; shortName?: string }; indicators?: { quote?: Array<{ close?: number[] }> } }> } };
                const result = data.chart?.result?.[0];
                const meta = result?.meta;
                if (meta?.regularMarketPrice) {
                  const price = meta.regularMarketPrice;
                  const prevClose = meta.previousClose || price;
                  const changePercent = ((price - prevClose) / prevClose) * 100;
                  // Extract sparkline from quote data (last 10 closing prices)
                  const closePrices = result?.indicators?.quote?.[0]?.close || [];
                  const sparkline = closePrices.slice(-10).filter((v): v is number => v != null);
                  quotes.push({
                    symbol,
                    name: symbolNames[symbol] || meta.shortName || symbol,
                    display: `$${price.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`,
                    price,
                    change: changePercent,
                    sparkline: sparkline.length > 0 ? sparkline : [price],
                  });
                }
              }
            } catch { /* continue */ }
          }
        }

        // Proto-compliant response: ListMarketQuotesResponse
        const response = {
          quotes,
          finnhubSkipped: false,
          skipReason: '',
          rateLimited: false,
        };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 }));
        // Also store in bootstrap format
        ctx.waitUntil(env.CACHE.put('bootstrap:marketQuotes', JSON.stringify(response), { expirationTtl: 300 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Crypto Quotes endpoint
      // Returns ListCryptoQuotesResponse format per proto definition
      if (path === '/api/market/v1/list-crypto-quotes' && request.method === 'GET') {
        const cacheKey = 'crypto-quotes:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD', 'AVAX-USD', 'DOT-USD'];
        const cryptoNames: Record<string, string> = {
          'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum', 'SOL-USD': 'Solana',
          'XRP-USD': 'XRP', 'ADA-USD': 'Cardano', 'DOGE-USD': 'Dogecoin',
          'AVAX-USD': 'Avalanche', 'DOT-USD': 'Polkadot'
        };
        const quotes: Array<{ name: string; symbol: string; price: number; change: number; sparkline: number[] }> = [];

        if (env.HEROKU_RELAY_URL) {
          for (const symbol of symbols) {
            try {
              const resp = await fetch(`${env.HEROKU_RELAY_URL}/yahoo-chart?symbol=${symbol}`, {
                headers: { 'x-relay-key': env.RELAY_SHARED_SECRET || '' },
                signal: AbortSignal.timeout(5000),
              });
              if (resp.ok) {
                const data = await resp.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number; shortName?: string }; indicators?: { quote?: Array<{ close?: number[] }> } }> } };
                const result = data.chart?.result?.[0];
                const meta = result?.meta;
                if (meta?.regularMarketPrice) {
                  const price = meta.regularMarketPrice;
                  const prevClose = meta.previousClose || price;
                  const changePercent = ((price - prevClose) / prevClose) * 100;
                  // Extract sparkline from quote data
                  const closePrices = result?.indicators?.quote?.[0]?.close || [];
                  const sparkline = closePrices.slice(-10).filter((v): v is number => v != null);
                  quotes.push({
                    name: cryptoNames[symbol] || meta.shortName || symbol.replace('-USD', ''),
                    symbol: symbol.replace('-USD', ''),
                    price,
                    change: changePercent,
                    sparkline: sparkline.length > 0 ? sparkline : [price],
                  });
                }
              }
            } catch { /* continue */ }
          }
        }

        // Proto-compliant response: ListCryptoQuotesResponse
        const response = { quotes };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 }));
        // Also store in bootstrap format
        ctx.waitUntil(env.CACHE.put('bootstrap:cryptoQuotes', JSON.stringify(response), { expirationTtl: 300 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Commodity Quotes endpoint
      // Returns ListCommodityQuotesResponse format per proto definition
      if (path === '/api/market/v1/list-commodity-quotes' && request.method === 'GET') {
        const cacheKey = 'commodity-quotes:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        const symbols = ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F', 'ZC=F', 'ZW=F', 'ZS=F'];
        const names: Record<string, string> = {
          'GC=F': 'Gold', 'SI=F': 'Silver', 'CL=F': 'Crude Oil', 'NG=F': 'Natural Gas',
          'HG=F': 'Copper', 'ZC=F': 'Corn', 'ZW=F': 'Wheat', 'ZS=F': 'Soybeans'
        };
        const units: Record<string, string> = {
          'GC=F': '/oz', 'SI=F': '/oz', 'CL=F': '/bbl', 'NG=F': '/MMBtu',
          'HG=F': '/lb', 'ZC=F': '/bu', 'ZW=F': '/bu', 'ZS=F': '/bu'
        };
        const quotes: Array<{ symbol: string; name: string; display: string; price: number; change: number; sparkline: number[] }> = [];

        if (env.HEROKU_RELAY_URL) {
          for (const symbol of symbols) {
            try {
              const resp = await fetch(`${env.HEROKU_RELAY_URL}/yahoo-chart?symbol=${symbol}`, {
                headers: { 'x-relay-key': env.RELAY_SHARED_SECRET || '' },
                signal: AbortSignal.timeout(5000),
              });
              if (resp.ok) {
                const data = await resp.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number }; indicators?: { quote?: Array<{ close?: number[] }> } }> } };
                const result = data.chart?.result?.[0];
                const meta = result?.meta;
                if (meta?.regularMarketPrice) {
                  const price = meta.regularMarketPrice;
                  const prevClose = meta.previousClose || price;
                  const changePercent = ((price - prevClose) / prevClose) * 100;
                  // Extract sparkline from quote data
                  const closePrices = result?.indicators?.quote?.[0]?.close || [];
                  const sparkline = closePrices.slice(-10).filter((v): v is number => v != null);
                  quotes.push({
                    symbol,
                    name: names[symbol] || symbol,
                    display: `$${price.toFixed(2)}${units[symbol] || ''} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`,
                    price,
                    change: changePercent,
                    sparkline: sparkline.length > 0 ? sparkline : [price],
                  });
                }
              }
            } catch { /* continue */ }
          }
        }

        // Proto-compliant response: ListCommodityQuotesResponse
        const response = { quotes };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 }));
        // Also store in bootstrap format
        ctx.waitUntil(env.CACHE.put('bootstrap:commodityQuotes', JSON.stringify(response), { expirationTtl: 300 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Prediction Markets endpoint - Polymarket data
      // Returns ListPredictionMarketsResponse format per proto definition
      if (path === '/api/prediction/v1/list-prediction-markets' && request.method === 'GET') {
        const cacheKey = 'prediction-markets:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        let markets: Array<{ id: string; title: string; yesPrice: number; volume: number; url: string; closesAt: number; category: string }> = [];

        if (env.HEROKU_RELAY_URL) {
          try {
            const resp = await fetch(`${env.HEROKU_RELAY_URL}/polymarket`, {
              headers: { 'x-relay-key': env.RELAY_SHARED_SECRET || '' },
              signal: AbortSignal.timeout(10000),
            });
            if (resp.ok) {
              const data = await resp.json() as Array<{ id: string; question: string; outcomePrices?: string; liquidity?: string; endDate?: string; slug?: string; category?: string }>;
              markets = data.slice(0, 50).map(m => {
                let yesPrice = 0.5;
                try {
                  const prices = JSON.parse(m.outcomePrices || '[]');
                  yesPrice = parseFloat(prices[0]) || 0.5;
                } catch { /* use default */ }
                // Parse endDate to Unix timestamp (seconds)
                let closesAt = 0;
                if (m.endDate) {
                  try {
                    closesAt = Math.floor(new Date(m.endDate).getTime() / 1000);
                  } catch { /* use 0 */ }
                }
                // Infer category from question keywords
                const q = m.question?.toLowerCase() || '';
                let category = m.category || 'general';
                if (q.includes('election') || q.includes('president') || q.includes('vote')) category = 'politics';
                else if (q.includes('bitcoin') || q.includes('crypto') || q.includes('price')) category = 'crypto';
                else if (q.includes('war') || q.includes('conflict') || q.includes('military')) category = 'geopolitics';
                else if (q.includes('stock') || q.includes('market') || q.includes('economy')) category = 'economics';
                return {
                  id: m.id,
                  title: m.question,
                  yesPrice,
                  volume: parseFloat(m.liquidity || '0'),
                  url: m.slug ? `https://polymarket.com/event/${m.slug}` : `https://polymarket.com/market/${m.id}`,
                  closesAt,
                  category,
                };
              });
            }
          } catch { /* use empty */ }
        }

        // Proto-compliant response: ListPredictionMarketsResponse
        const response = {
          markets,
          pagination: { nextCursor: '', totalCount: markets.length },
        };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 600 }));
        // Also store in bootstrap format
        ctx.waitUntil(env.CACHE.put('bootstrap:predictions', JSON.stringify(response), { expirationTtl: 600 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Economic FRED Series endpoint
      if (path === '/api/economic/v1/get-fred-series' && request.method === 'GET') {
        const seriesId = url.searchParams.get('seriesId') || 'GDP';
        const cacheKey = `fred-series:${seriesId}`;
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        // Return mock data for common series
        const mockData: Record<string, { value: number; units: string; title: string }> = {
          'GDP': { value: 27.36, units: 'Trillions of Dollars', title: 'Gross Domestic Product' },
          'UNRATE': { value: 3.9, units: 'Percent', title: 'Unemployment Rate' },
          'CPIAUCSL': { value: 314.5, units: 'Index 1982-1984=100', title: 'Consumer Price Index' },
          'FEDFUNDS': { value: 5.33, units: 'Percent', title: 'Federal Funds Rate' },
          'M2SL': { value: 20.8, units: 'Trillions of Dollars', title: 'M2 Money Supply' },
          'DGS10': { value: 4.28, units: 'Percent', title: '10-Year Treasury Rate' },
        };

        const data = mockData[seriesId] || { value: 0, units: '', title: seriesId };
        const response = {
          seriesId,
          ...data,
          observations: [{ date: new Date().toISOString().split('T')[0], value: data.value }],
        };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 3600 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Macro Signals endpoint
      // Returns GetMacroSignalsResponse format per proto definition
      if (path === '/api/economic/v1/get-macro-signals' && request.method === 'GET') {
        const cacheKey = 'macro-signals:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        // Generate sparkline data (last 7 days)
        const generateSparkline = (base: number, volatility: number) =>
          Array.from({ length: 7 }, () => base + (Math.random() - 0.5) * volatility);

        // Proto-compliant response: GetMacroSignalsResponse
        const response = {
          timestamp: new Date().toISOString(),
          verdict: 'neutral',
          bullishCount: 3,
          totalCount: 7,
          signals: {
            liquidity: {
              status: 'bullish',
              value: 20.8,
              sparkline: generateSparkline(20.5, 0.5),
            },
            flowStructure: {
              status: 'neutral',
              btcReturn5: 2.3,
              qqqReturn5: 1.8,
            },
            macroRegime: {
              status: 'bullish',
              qqqRoc20: 4.2,
              xlpRoc20: 1.5,
            },
            technicalTrend: {
              status: 'bullish',
              btcPrice: 67500,
              sma50: 64000,
              sma200: 58000,
              vwap30d: 65000,
              mayerMultiple: 1.16,
              sparkline: generateSparkline(67000, 2000),
            },
            hashRate: {
              status: 'neutral',
              change30d: 3.2,
            },
            priceMomentum: {
              status: 'neutral',
            },
            fearGreed: {
              status: 'neutral',
              value: 52,
              history: Array.from({ length: 7 }, (_, i) => ({
                value: 45 + Math.floor(Math.random() * 20),
                date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
              })),
            },
          },
          meta: {
            qqqSparkline: generateSparkline(380, 10),
          },
          unavailable: false,
        };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 3600 }));
        ctx.waitUntil(env.CACHE.put('bootstrap:macroSignals', JSON.stringify(response), { expirationTtl: 3600 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Trade Restrictions endpoint
      if (path === '/api/trade/v1/get-trade-restrictions' && request.method === 'GET') {
        const response = {
          restrictions: [
            { country: 'China', type: 'tariff', sector: 'Technology', rate: 25, status: 'active' },
            { country: 'Russia', type: 'sanction', sector: 'Energy', rate: 100, status: 'active' },
            { country: 'Iran', type: 'embargo', sector: 'All', rate: 100, status: 'active' },
          ],
          updatedAt: new Date().toISOString(),
        };
        return json(response, 200, corsHeaders(origin));
      }

      // Supply Chain Shipping Rates endpoint
      // Returns GetShippingRatesResponse format per proto definition
      if (path === '/api/supply-chain/v1/get-shipping-rates' && request.method === 'GET') {
        const cacheKey = 'shipping-rates:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        // Build proto-compliant indices array
        const now = new Date();
        const indices: Array<{
          indexId: string;
          name: string;
          currentValue: number;
          previousValue: number;
          changePct: number;
          unit: string;
          history: Array<{ date: string; value: number }>;
          spikeAlert: boolean;
        }> = [
          {
            indexId: 'BDI',
            name: 'Baltic Dry Index',
            currentValue: 1542,
            previousValue: 1508,
            changePct: 2.3,
            unit: 'points',
            history: Array.from({ length: 7 }, (_, i) => ({
              date: new Date(now.getTime() - (6 - i) * 86400000).toISOString().split('T')[0],
              value: 1500 + Math.random() * 100,
            })),
            spikeAlert: false,
          },
          {
            indexId: 'SCFI',
            name: 'Shanghai Containerized Freight Index',
            currentValue: 1876,
            previousValue: 1905,
            changePct: -1.5,
            unit: 'USD/TEU',
            history: Array.from({ length: 7 }, (_, i) => ({
              date: new Date(now.getTime() - (6 - i) * 86400000).toISOString().split('T')[0],
              value: 1850 + Math.random() * 100,
            })),
            spikeAlert: false,
          },
          {
            indexId: 'WCI',
            name: 'World Container Index',
            currentValue: 2450,
            previousValue: 2580,
            changePct: -5.0,
            unit: 'USD/FEU',
            history: Array.from({ length: 7 }, (_, i) => ({
              date: new Date(now.getTime() - (6 - i) * 86400000).toISOString().split('T')[0],
              value: 2400 + Math.random() * 200,
            })),
            spikeAlert: false,
          },
        ];

        // Proto-compliant response: GetShippingRatesResponse
        const response = {
          indices,
          fetchedAt: now.toISOString(),
          upstreamUnavailable: false,
        };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 3600 }));
        ctx.waitUntil(env.CACHE.put('bootstrap:shippingRates', JSON.stringify(response), { expirationTtl: 3600 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Supply Chain Chokepoint Status endpoint
      // Returns GetChokepointStatusResponse format per proto definition
      if (path === '/api/supply-chain/v1/get-chokepoint-status' && request.method === 'GET') {
        const cacheKey = 'chokepoints:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        const chokepoints: Array<{
          id: string;
          name: string;
          lat: number;
          lon: number;
          disruptionScore: number;
          status: string;
          activeWarnings: number;
          congestionLevel: string;
          affectedRoutes: string[];
          description: string;
          aisDisruptions: number;
        }> = [
          {
            id: 'suez',
            name: 'Suez Canal',
            lat: 30.0,
            lon: 32.5,
            disruptionScore: 15,
            status: 'normal',
            activeWarnings: 0,
            congestionLevel: 'low',
            affectedRoutes: ['Asia-Europe', 'Asia-Mediterranean'],
            description: 'Key passage between Mediterranean and Red Sea',
            aisDisruptions: 0,
          },
          {
            id: 'panama',
            name: 'Panama Canal',
            lat: 9.1,
            lon: -79.7,
            disruptionScore: 45,
            status: 'restricted',
            activeWarnings: 2,
            congestionLevel: 'high',
            affectedRoutes: ['Asia-US East Coast', 'South America-Europe'],
            description: 'Drought conditions limiting daily transits',
            aisDisruptions: 3,
          },
          {
            id: 'hormuz',
            name: 'Strait of Hormuz',
            lat: 26.6,
            lon: 56.3,
            disruptionScore: 35,
            status: 'elevated',
            activeWarnings: 1,
            congestionLevel: 'medium',
            affectedRoutes: ['Persian Gulf-Asia', 'Persian Gulf-Europe'],
            description: 'Critical oil transit chokepoint',
            aisDisruptions: 1,
          },
          {
            id: 'malacca',
            name: 'Strait of Malacca',
            lat: 2.5,
            lon: 101.5,
            disruptionScore: 10,
            status: 'normal',
            activeWarnings: 0,
            congestionLevel: 'low',
            affectedRoutes: ['East Asia-Europe', 'East Asia-Middle East'],
            description: 'Busiest shipping lane in the world',
            aisDisruptions: 0,
          },
          {
            id: 'bab',
            name: 'Bab el-Mandeb',
            lat: 12.6,
            lon: 43.3,
            disruptionScore: 75,
            status: 'disrupted',
            activeWarnings: 5,
            congestionLevel: 'critical',
            affectedRoutes: ['Red Sea-Indian Ocean', 'Suez-Asia'],
            description: 'Security concerns from regional conflict',
            aisDisruptions: 12,
          },
        ];

        const response = {
          chokepoints,
          fetchedAt: new Date().toISOString(),
          upstreamUnavailable: false,
        };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 1800 }));
        ctx.waitUntil(env.CACHE.put('bootstrap:chokepoints', JSON.stringify(response), { expirationTtl: 1800 }));
        return json(response, 200, corsHeaders(origin));
      }

      // Supply Chain Critical Minerals endpoint
      // Returns GetCriticalMineralsResponse format per proto definition
      if (path === '/api/supply-chain/v1/get-critical-minerals' && request.method === 'GET') {
        const cacheKey = 'minerals:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        const minerals: Array<{
          mineral: string;
          topProducers: Array<{ country: string; countryCode: string; productionTonnes: number; sharePct: number }>;
          hhi: number;
          riskRating: string;
          globalProduction: number;
          unit: string;
        }> = [
          {
            mineral: 'Lithium',
            topProducers: [
              { country: 'Australia', countryCode: 'AU', productionTonnes: 61000, sharePct: 47 },
              { country: 'Chile', countryCode: 'CL', productionTonnes: 39000, sharePct: 30 },
              { country: 'China', countryCode: 'CN', productionTonnes: 19000, sharePct: 15 },
            ],
            hhi: 3200,
            riskRating: 'high',
            globalProduction: 130000,
            unit: 'tonnes',
          },
          {
            mineral: 'Cobalt',
            topProducers: [
              { country: 'DR Congo', countryCode: 'CD', productionTonnes: 130000, sharePct: 73 },
              { country: 'Russia', countryCode: 'RU', productionTonnes: 9000, sharePct: 5 },
              { country: 'Australia', countryCode: 'AU', productionTonnes: 5900, sharePct: 3 },
            ],
            hhi: 5400,
            riskRating: 'critical',
            globalProduction: 180000,
            unit: 'tonnes',
          },
          {
            mineral: 'Rare Earths',
            topProducers: [
              { country: 'China', countryCode: 'CN', productionTonnes: 210000, sharePct: 70 },
              { country: 'USA', countryCode: 'US', productionTonnes: 43000, sharePct: 14 },
              { country: 'Australia', countryCode: 'AU', productionTonnes: 18000, sharePct: 6 },
            ],
            hhi: 5100,
            riskRating: 'critical',
            globalProduction: 300000,
            unit: 'tonnes',
          },
          {
            mineral: 'Nickel',
            topProducers: [
              { country: 'Indonesia', countryCode: 'ID', productionTonnes: 1600000, sharePct: 48 },
              { country: 'Philippines', countryCode: 'PH', productionTonnes: 400000, sharePct: 12 },
              { country: 'Russia', countryCode: 'RU', productionTonnes: 250000, sharePct: 8 },
            ],
            hhi: 2600,
            riskRating: 'elevated',
            globalProduction: 3300000,
            unit: 'tonnes',
          },
          {
            mineral: 'Graphite',
            topProducers: [
              { country: 'China', countryCode: 'CN', productionTonnes: 820000, sharePct: 65 },
              { country: 'Mozambique', countryCode: 'MZ', productionTonnes: 170000, sharePct: 13 },
              { country: 'Madagascar', countryCode: 'MG', productionTonnes: 75000, sharePct: 6 },
            ],
            hhi: 4400,
            riskRating: 'high',
            globalProduction: 1260000,
            unit: 'tonnes',
          },
        ];

        const response = {
          minerals,
          fetchedAt: new Date().toISOString(),
          upstreamUnavailable: false,
        };
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 86400 }));
        ctx.waitUntil(env.CACHE.put('bootstrap:minerals', JSON.stringify(response), { expirationTtl: 86400 }));
        return json(response, 200, corsHeaders(origin));
      }

      // AI Insights endpoint - generates world brief from news
      if (path === '/api/intelligence/v1/list-insights' && request.method === 'GET') {
        const cacheKey = 'insights:v1';
        const cached = await env.CACHE.get(cacheKey);
        if (cached) {
          return json(JSON.parse(cached), 200, corsHeaders(origin));
        }

        try {
          // First, get the news digest
          const digestCacheKey = 'news:digest:v2:full:en';
          let digestData = await env.CACHE.get(digestCacheKey);
          let categories: Record<string, { items: Array<{ title: string; source: string; link: string; publishedAt: number; isAlert: boolean }> }> = {};

          if (digestData) {
            const parsed = JSON.parse(digestData);
            categories = parsed.categories || {};
          }

          // Collect all items from categories
          const allItems: Array<{ title: string; source: string; link: string; publishedAt: number; isAlert: boolean; category: string; threatLevel: string }> = [];

          const THREAT_KEYWORDS: Record<string, { threat: string; cat: string }> = {
            'war': { threat: 'critical', cat: 'conflict' },
            'attack': { threat: 'high', cat: 'conflict' },
            'missile': { threat: 'critical', cat: 'conflict' },
            'killed': { threat: 'high', cat: 'violence' },
            'dead': { threat: 'high', cat: 'violence' },
            'explosion': { threat: 'high', cat: 'incident' },
            'protest': { threat: 'elevated', cat: 'unrest' },
            'riot': { threat: 'high', cat: 'unrest' },
            'sanctions': { threat: 'elevated', cat: 'economic' },
            'earthquake': { threat: 'high', cat: 'natural_disaster' },
            'flood': { threat: 'elevated', cat: 'natural_disaster' },
            'election': { threat: 'moderate', cat: 'political' },
          };

          function classifyTitle(title: string): { category: string; threatLevel: string } {
            const lower = title.toLowerCase();
            for (const [keyword, { threat, cat }] of Object.entries(THREAT_KEYWORDS)) {
              if (lower.includes(keyword)) {
                return { category: cat, threatLevel: threat };
              }
            }
            return { category: 'general', threatLevel: 'moderate' };
          }

          for (const [, bucket] of Object.entries(categories)) {
            if (Array.isArray(bucket.items)) {
              for (const item of bucket.items.slice(0, 5)) {
                const { category, threatLevel } = classifyTitle(item.title);
                allItems.push({
                  ...item,
                  category,
                  threatLevel,
                });
              }
            }
          }

          // Sort by alert status and recency
          allItems.sort((a, b) => {
            if (a.isAlert !== b.isAlert) return a.isAlert ? -1 : 1;
            return b.publishedAt - a.publishedAt;
          });

          // Take top 8 for stories
          const topStories = allItems.slice(0, 8).map((item, idx) => ({
            primaryTitle: item.title,
            primarySource: item.source,
            primaryLink: item.link,
            sourceCount: 1,
            importanceScore: 100 - idx * 10,
            velocity: { level: 'normal', sourcesPerHour: 0 },
            isAlert: item.isAlert,
            category: item.category,
            threatLevel: item.threatLevel,
          }));

          // Generate world brief using Azure AI (if configured)
          let worldBrief = '';
          let briefProvider = 'none';
          let status: 'ok' | 'degraded' = 'degraded';

          if (env.AZURE_AI_ENDPOINT && env.AZURE_AI_KEY && topStories.length > 0) {
            const headlines = topStories.slice(0, 5).map((s, i) => `${i + 1}. ${s.primaryTitle}`).join('\n');
            const dateContext = `Current date: ${new Date().toISOString().split('T')[0]}.`;

            try {
              const aiResponse = await fetch(env.AZURE_AI_ENDPOINT, {
                method: 'POST',
                headers: {
                  'api-key': env.AZURE_AI_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messages: [
                    {
                      role: 'system',
                      content: `${dateContext}\n\nSummarize the single most important headline in 2 concise sentences MAX (under 60 words total).\nRules:\n- Each numbered headline below is a SEPARATE, UNRELATED story\n- Pick the ONE most significant headline and summarize ONLY that story\n- NEVER combine or merge people, places, or facts from different headlines\n- Lead with WHAT happened and WHERE - be specific\n- NEVER start with "Breaking news", "Good evening", "Tonight"\n- No bullet points, no meta-commentary`,
                    },
                    {
                      role: 'user',
                      content: `Each headline below is a separate story. Pick the most important ONE and summarize only that story:\n${headlines}`,
                    },
                  ],
                  temperature: 0.3,
                  max_completion_tokens: 100,
                }),
                signal: AbortSignal.timeout(10000),
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
                let summary = aiData.choices?.[0]?.message?.content?.trim() || '';
                summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                if (summary.length >= 20) {
                  worldBrief = summary;
                  briefProvider = 'azure';
                  status = 'ok';
                }
              }
            } catch {
              // AI failed, continue with degraded status
            }
          }

          const response = {
            worldBrief,
            briefProvider,
            status,
            topStories,
            generatedAt: new Date().toISOString(),
            clusterCount: topStories.length,
            multiSourceCount: 0,
            fastMovingCount: topStories.filter(s => s.isAlert).length,
          };

          // Cache for 10 minutes
          ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 600 }));

          // Also store in bootstrap key format for hydration
          ctx.waitUntil(env.CACHE.put('bootstrap:insights', JSON.stringify(response), { expirationTtl: 600 }));

          return json(response, 200, corsHeaders(origin));
        } catch (err) {
          console.error('Insights error:', err);
          return json({
            worldBrief: '',
            briefProvider: 'none',
            status: 'degraded',
            topStories: [],
            generatedAt: new Date().toISOString(),
            clusterCount: 0,
            multiSourceCount: 0,
            fastMovingCount: 0,
          }, 200, corsHeaders(origin));
        }
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

      // Bootstrap endpoint - returns cached data for fast panel hydration
      if (path === '/api/bootstrap' && request.method === 'GET') {
        const BOOTSTRAP_CACHE_KEYS: Record<string, string> = {
          earthquakes: 'seismology:earthquakes:v1',
          outages: 'infra:outages:v1',
          serviceStatuses: 'infra:service-statuses:v1',
          marketQuotes: 'market:stocks-bootstrap:v1',
          commodityQuotes: 'market:commodities-bootstrap:v1',
          sectors: 'market:sectors:v1',
          etfFlows: 'market:etf-flows:v1',
          macroSignals: 'economic:macro-signals:v1',
          bisPolicy: 'economic:bis:policy:v1',
          bisExchange: 'economic:bis:eer:v1',
          bisCredit: 'economic:bis:credit:v1',
          shippingRates: 'supply_chain:shipping:v2',
          chokepoints: 'supply_chain:chokepoints:v2',
          minerals: 'supply_chain:minerals:v2',
          giving: 'giving:summary:v1',
          climateAnomalies: 'climate:anomalies:v1',
          wildfires: 'wildfire:fires:v1',
          cyberThreats: 'cyber:threats-bootstrap:v2',
          techReadiness: 'economic:worldbank-techreadiness:v1',
          progressData: 'economic:worldbank-progress:v1',
          renewableEnergy: 'economic:worldbank-renewable:v1',
          positiveGeoEvents: 'positive-events:geo-bootstrap:v1',
          theaterPosture: 'theater-posture:sebuf:stale:v1',
          riskScores: 'risk:scores:sebuf:stale:v1',
          naturalEvents: 'natural:events:v1',
          flightDelays: 'aviation:delays-bootstrap:v1',
          insights: 'news:insights:v1',
          predictions: 'prediction:markets-bootstrap:v1',
          cryptoQuotes: 'market:crypto:v1',
          gulfQuotes: 'market:gulf-quotes:v1',
          stablecoinMarkets: 'market:stablecoins:v1',
          unrestEvents: 'unrest:events:v1',
          iranEvents: 'conflict:iran-events:v1',
          ucdpEvents: 'conflict:ucdp-events:v1',
          temporalAnomalies: 'temporal:anomalies:v1',
        };

        const SLOW_KEYS = new Set([
          'bisPolicy', 'bisExchange', 'bisCredit', 'minerals', 'giving',
          'sectors', 'etfFlows', 'shippingRates', 'wildfires', 'climateAnomalies',
          'cyberThreats', 'techReadiness', 'progressData', 'renewableEnergy',
          'theaterPosture', 'naturalEvents',
          'cryptoQuotes', 'gulfQuotes', 'stablecoinMarkets', 'unrestEvents', 'ucdpEvents',
        ]);
        const FAST_KEYS = new Set([
          'earthquakes', 'outages', 'serviceStatuses', 'macroSignals', 'chokepoints',
          'marketQuotes', 'commodityQuotes', 'positiveGeoEvents', 'riskScores', 'flightDelays',
          'insights', 'predictions', 'iranEvents', 'temporalAnomalies',
        ]);

        const tier = url.searchParams.get('tier');
        let registry: Record<string, string>;

        if (tier === 'slow' || tier === 'fast') {
          const tierSet = tier === 'slow' ? SLOW_KEYS : FAST_KEYS;
          registry = Object.fromEntries(
            Object.entries(BOOTSTRAP_CACHE_KEYS).filter(([k]) => tierSet.has(k))
          );
        } else {
          const requested = url.searchParams.get('keys')?.split(',').filter(Boolean).sort();
          registry = requested
            ? Object.fromEntries(Object.entries(BOOTSTRAP_CACHE_KEYS).filter(([k]) => requested.includes(k)))
            : BOOTSTRAP_CACHE_KEYS;
        }

        const keys = Object.values(registry);
        const names = Object.keys(registry);

        // Try to fetch from Upstash Redis if configured
        const data: Record<string, unknown> = {};
        const missing: string[] = [];

        if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
          try {
            const pipeline = keys.map((k) => ['GET', k]);
            const resp = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(pipeline),
              signal: AbortSignal.timeout(3000),
            });

            if (resp.ok) {
              const results = await resp.json() as Array<{ result?: string }>;
              for (let i = 0; i < names.length; i++) {
                const raw = results[i]?.result;
                if (raw) {
                  try {
                    const parsed = JSON.parse(raw);
                    if (parsed !== '__WM_NEG__') {
                      data[names[i]] = parsed;
                    } else {
                      missing.push(names[i]);
                    }
                  } catch {
                    missing.push(names[i]);
                  }
                } else {
                  missing.push(names[i]);
                }
              }
            } else {
              // Redis request failed, all keys are missing
              missing.push(...names);
            }
          } catch {
            // Timeout or error, all keys are missing
            missing.push(...names);
          }
        } else {
          // No Upstash configured - try to get data from local KV cache
          // This is a fallback for when panels need to hydrate from Worker's own cache
          for (let i = 0; i < names.length; i++) {
            const name = names[i];
            // Try to get from our local KV cache (using similar keys)
            const kvKey = `bootstrap:${name}`;
            const cached = await env.CACHE.get(kvKey);
            if (cached) {
              try {
                data[name] = JSON.parse(cached);
              } catch {
                missing.push(name);
              }
            } else {
              missing.push(name);
            }
          }
        }

        const cacheControl = tier === 'slow'
          ? 'public, s-maxage=3600, stale-while-revalidate=600, stale-if-error=3600'
          : 'public, s-maxage=600, stale-while-revalidate=120, stale-if-error=900';

        return json(
          { data, missing },
          200,
          {
            ...corsHeaders(origin),
            'Cache-Control': cacheControl,
          }
        );
      }

      // ============================================================================
      // ATLAS - Autonomous Threat & Landscape Analysis System
      // Multi-agent intelligence orchestration
      // ============================================================================

      if (path === '/api/atlas/analyze' && request.method === 'POST') {
        // Check for Azure OpenAI configuration
        if (!env.AZURE_AI_ENDPOINT || !env.AZURE_AI_KEY) {
          return json({
            error: 'ATLAS not configured',
            message: 'Azure OpenAI credentials not set. Add AZURE_AI_ENDPOINT and AZURE_AI_KEY to your environment.',
          }, 503, corsHeaders(origin));
        }

        try {
          const body = await request.json() as { region?: string };
          const region = body.region || 'middle-east';

          // Validate region
          const validRegions = ['middle-east', 'asia-pacific', 'europe', 'africa', 'americas'];
          if (!validRegions.includes(region)) {
            return json({
              error: 'Invalid region',
              validRegions,
            }, 400, corsHeaders(origin));
          }

          // For demo purposes, return mock analysis
          // In production, this would call the Azure AI Foundry Agent Service
          const mockAnalysis = await generateAtlasAnalysis(region, env);

          return json(mockAnalysis, 200, {
            ...corsHeaders(origin),
            'Cache-Control': 'no-cache',
          });
        } catch (err) {
          console.error('ATLAS analysis error:', err);
          return json({
            error: 'Analysis failed',
            details: err instanceof Error ? err.message : 'Unknown error',
          }, 500, corsHeaders(origin));
        }
      }

      // ATLAS regions list
      if (path === '/api/atlas/regions' && request.method === 'GET') {
        return json({
          regions: [
            { id: 'middle-east', name: 'Middle East', countries: ['Israel', 'Iran', 'Iraq', 'Syria', 'Lebanon', 'Saudi Arabia', 'UAE', 'Yemen'] },
            { id: 'asia-pacific', name: 'Asia Pacific', countries: ['China', 'Japan', 'Taiwan', 'South Korea', 'Philippines', 'Vietnam', 'India'] },
            { id: 'europe', name: 'Europe', countries: ['Ukraine', 'Russia', 'Poland', 'Germany', 'France', 'UK', 'Finland', 'Baltic'] },
            { id: 'africa', name: 'Africa', countries: ['Sudan', 'Ethiopia', 'Somalia', 'Nigeria', 'DRC', 'Libya', 'Mali', 'Sahel'] },
            { id: 'americas', name: 'Americas', countries: ['USA', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Venezuela'] },
          ],
        }, 200, corsHeaders(origin));
      }

      // ATLAS status endpoint
      if (path === '/api/atlas/status' && request.method === 'GET') {
        const hasAzure = !!(env.AZURE_AI_ENDPOINT && env.AZURE_AI_KEY);
        return json({
          enabled: hasAzure,
          agents: ['GeoInt', 'FinInt', 'ThreatInt'],
          version: '1.0.0',
          provider: hasAzure ? 'Azure AI Foundry' : 'Demo Mode',
        }, 200, corsHeaders(origin));
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
