/**
 * Shipping Stress Index Service
 *
 * Tracks dry bulk shipping ETFs via Yahoo Finance to compute a freight stress index.
 * High volatility in shipping ETFs indicates supply chain stress.
 *
 * Symbols tracked:
 * - BDRY: Breakwave Dry Bulk Shipping ETF
 * - SBLK: Star Bulk Carriers
 * - EGLE: Eagle Bulk Shipping
 * - ZIM: ZIM Integrated Shipping
 */

import { createCircuitBreaker } from '@/utils';
import { isDesktopRuntime, getRemoteApiBaseUrl } from '@/services/runtime';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Shipping ETF symbols
const SHIPPING_SYMBOLS: { symbol: string; name: string; type: 'dry-bulk' | 'container' }[] = [
  { symbol: 'BDRY', name: 'Breakwave Dry Bulk ETF', type: 'dry-bulk' },
  { symbol: 'SBLK', name: 'Star Bulk Carriers', type: 'dry-bulk' },
  { symbol: 'EGLE', name: 'Eagle Bulk Shipping', type: 'dry-bulk' },
  { symbol: 'ZIM', name: 'ZIM Integrated Shipping', type: 'container' },
];

// Stress thresholds based on average daily change
const STRESS_THRESHOLDS: { threshold: number; level: ShippingStressLevel }[] = [
  { threshold: 5.0, level: 'extreme' },
  { threshold: 3.0, level: 'high' },
  { threshold: 1.5, level: 'elevated' },
  { threshold: 0.5, level: 'moderate' },
];

export type ShippingStressLevel = 'extreme' | 'high' | 'elevated' | 'moderate' | 'low';

export interface ShippingQuote {
  symbol: string;
  name: string;
  type: 'dry-bulk' | 'container';
  price: number | null;
  changePct: number | null;
  volume: number | null;
}

export interface ShippingStressData {
  quotes: ShippingQuote[];
  stressScore: number;
  stressLevel: ShippingStressLevel;
  avgChangePct: number;
  signals: string[];
  timestamp: string;
  source: 'yahoo-finance';
}

export interface ShippingStressFetchResult {
  ok: boolean;
  data: ShippingStressData | null;
  error?: string;
}

// Circuit breaker for reliability
const breaker = createCircuitBreaker<ShippingStressData>({
  name: 'Shipping Stress',
  cacheTtlMs: CACHE_TTL,
  persistCache: true,
});

// Cache
let cachedData: { data: ShippingStressData; timestamp: number } | null = null;

// Default empty data for fallback
const emptyShippingStressData: ShippingStressData = {
  quotes: [],
  stressScore: 0,
  stressLevel: 'low',
  avgChangePct: 0,
  signals: [],
  timestamp: new Date().toISOString(),
  source: 'yahoo-finance',
};

/**
 * Fetch a single quote from Yahoo Finance via our relay
 */
async function fetchYahooQuote(symbol: string): Promise<{ price: number | null; changePct: number | null; volume: number | null }> {
  try {
    const baseUrl = isDesktopRuntime() ? getRemoteApiBaseUrl() : '';
    const response = await fetch(`${baseUrl}/api/yahoo-chart?symbol=${symbol}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[ShippingStress] HTTP ${response.status} for ${symbol}`);
      return { price: null, changePct: null, volume: null };
    }

    const data = await response.json();

    // Extract from Yahoo Finance response
    const result = data?.chart?.result?.[0];
    if (!result) return { price: null, changePct: null, volume: null };

    const meta = result.meta;
    const price = meta?.regularMarketPrice ?? null;
    const prevClose = meta?.previousClose ?? meta?.chartPreviousClose;
    const volume = meta?.regularMarketVolume ?? null;

    let changePct: number | null = null;
    if (price !== null && prevClose && prevClose > 0) {
      changePct = ((price - prevClose) / prevClose) * 100;
    }

    return { price, changePct, volume };
  } catch (e) {
    console.warn(`[ShippingStress] Failed to fetch ${symbol}:`, e);
    return { price: null, changePct: null, volume: null };
  }
}

/**
 * Determine stress level from average change
 */
function getStressLevel(avgChange: number): ShippingStressLevel {
  for (const { threshold, level } of STRESS_THRESHOLDS) {
    if (avgChange >= threshold) return level;
  }
  return 'low';
}

/**
 * Fetch all shipping stress data
 */
async function fetchShippingStressData(): Promise<ShippingStressData> {
  const results = await Promise.all(
    SHIPPING_SYMBOLS.map(async (s) => {
      const quote = await fetchYahooQuote(s.symbol);
      return {
        symbol: s.symbol,
        name: s.name,
        type: s.type,
        ...quote,
      };
    })
  );

  const quotes: ShippingQuote[] = results;

  // Calculate stress metrics
  const validChanges = quotes
    .map(q => q.changePct)
    .filter((c): c is number => c !== null)
    .map(c => Math.abs(c));

  const avgChangePct = validChanges.length > 0
    ? validChanges.reduce((a, b) => a + b, 0) / validChanges.length
    : 0;

  // Stress score: 0-100 scale (10% change = 100 stress)
  const stressScore = Math.min(100, Math.round(avgChangePct * 10 * 10) / 10);
  const stressLevel = getStressLevel(avgChangePct);

  // Generate signals for significant movers
  const signals: string[] = [];
  for (const q of quotes) {
    if (q.changePct !== null && Math.abs(q.changePct) > 3.0) {
      const direction = q.changePct > 0 ? 'up' : 'down';
      signals.push(`${q.symbol} ${direction} ${Math.abs(q.changePct).toFixed(1)}%`);
    }
  }

  return {
    quotes,
    stressScore,
    stressLevel,
    avgChangePct: Math.round(avgChangePct * 100) / 100,
    signals,
    timestamp: new Date().toISOString(),
    source: 'yahoo-finance',
  };
}

/**
 * Public API: Fetch shipping stress data
 */
export async function fetchShippingStress(): Promise<ShippingStressFetchResult> {
  // Check cache
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return { ok: true, data: cachedData.data };
  }

  try {
    const data = await breaker.execute(
      fetchShippingStressData,
      cachedData?.data ?? emptyShippingStressData,
    );

    if (data && data.quotes.length > 0) {
      cachedData = { data, timestamp: Date.now() };
      return { ok: true, data };
    }

    return { ok: false, data: cachedData?.data ?? null, error: 'No data available' };
  } catch (e) {
    console.error('[ShippingStress] Fetch failed:', e);
    return { ok: false, data: cachedData?.data ?? null, error: String(e) };
  }
}

/**
 * Get stress level color
 */
export function getStressColor(level: ShippingStressLevel): string {
  switch (level) {
    case 'extreme': return '#ff0000';
    case 'high': return '#ff4500';
    case 'elevated': return '#ffa500';
    case 'moderate': return '#ffd700';
    default: return '#4caf50';
  }
}

/**
 * Get stress level icon
 */
export function getStressIcon(level: ShippingStressLevel): string {
  switch (level) {
    case 'extreme': return '\u{1F6A8}'; // 🚨
    case 'high': return '\u{26A0}\u{FE0F}'; // ⚠️
    case 'elevated': return '\u{1F6A2}'; // 🚢
    case 'moderate': return '\u{2693}'; // ⚓
    default: return '\u{2705}'; // ✅
  }
}

/**
 * Format percentage for display
 */
export function formatChangePct(pct: number | null): string {
  if (pct === null) return '--';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
