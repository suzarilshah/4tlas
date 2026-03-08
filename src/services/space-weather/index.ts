/**
 * Space Weather Service
 *
 * Fetches real-time solar activity data from NOAA's Space Weather Prediction Center (SWPC).
 * Data includes: Kp index (geomagnetic activity), solar X-ray flux, and space weather alerts.
 *
 * All SWPC APIs are free and require no API key.
 */

import { createCircuitBreaker } from '@/utils';

// NOAA SWPC endpoints (free, no API key required)
const SWPC_BASE = 'https://services.swpc.noaa.gov';
const KP_URL = `${SWPC_BASE}/products/noaa-planetary-k-index.json`;
const XRAY_URL = `${SWPC_BASE}/json/goes/primary/xrays-6-hour.json`;
const ALERTS_URL = `${SWPC_BASE}/products/alerts.json`;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export type KpLevel = 'G5 Extreme' | 'G4 Severe' | 'G3 Strong' | 'G2 Moderate' | 'G1 Minor' | 'Active' | 'Quiet';
export type FlareClass = 'X' | 'M' | 'C' | 'B' | 'A';

export interface SpaceWeatherData {
  currentKp: number | null;
  kpLevel: KpLevel;
  kpTrend: 'rising' | 'falling' | 'stable';
  latestFlareClass: string | null;
  flareIntensity: 'extreme' | 'major' | 'moderate' | 'minor' | 'quiet';
  alerts: SpaceWeatherAlert[];
  kpRecent: { time: string; kp: number }[];
  timestamp: string;
  source: 'noaa-swpc';
}

export interface SpaceWeatherAlert {
  issueTime: string;
  message: string;
  type: 'warning' | 'watch' | 'alert' | 'summary';
  severity: 'critical' | 'high' | 'moderate' | 'low';
}

export interface SpaceWeatherFetchResult {
  ok: boolean;
  data: SpaceWeatherData | null;
  error?: string;
}

// Circuit breaker for reliability
const breaker = createCircuitBreaker<SpaceWeatherData>({
  name: 'Space Weather',
  cacheTtlMs: CACHE_TTL,
  persistCache: true,
});

// Cache
let cachedData: { data: SpaceWeatherData; timestamp: number } | null = null;

// Default empty data for fallback
const emptySpaceWeatherData: SpaceWeatherData = {
  currentKp: null,
  kpLevel: 'Quiet',
  kpTrend: 'stable',
  latestFlareClass: null,
  flareIntensity: 'quiet',
  alerts: [],
  kpRecent: [],
  timestamp: new Date().toISOString(),
  source: 'noaa-swpc',
};

/**
 * Classify Kp index into storm level
 */
function classifyKp(kp: number): KpLevel {
  if (kp >= 9) return 'G5 Extreme';
  if (kp >= 8) return 'G4 Severe';
  if (kp >= 7) return 'G3 Strong';
  if (kp >= 6) return 'G2 Moderate';
  if (kp >= 5) return 'G1 Minor';
  if (kp >= 4) return 'Active';
  return 'Quiet';
}

/**
 * Classify X-ray flux into flare class
 */
function classifyXray(flux: number): string {
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return 'A';
}

/**
 * Get flare intensity level
 */
function getFlareIntensity(flareClass: string | null): SpaceWeatherData['flareIntensity'] {
  if (!flareClass) return 'quiet';
  const firstChar = flareClass.charAt(0).toUpperCase();
  if (firstChar === 'X') return 'extreme';
  if (firstChar === 'M') return 'major';
  if (firstChar === 'C') return 'moderate';
  if (firstChar === 'B') return 'minor';
  return 'quiet';
}

/**
 * Determine Kp trend from recent readings
 */
function getKpTrend(recent: { time: string; kp: number }[]): SpaceWeatherData['kpTrend'] {
  if (recent.length < 3) return 'stable';
  const last = recent[recent.length - 1]?.kp ?? 0;
  const prev = recent[recent.length - 3]?.kp ?? 0;
  const diff = last - prev;
  if (diff >= 1) return 'rising';
  if (diff <= -1) return 'falling';
  return 'stable';
}

/**
 * Classify alert severity based on content
 */
function classifyAlertSeverity(message: string): SpaceWeatherAlert['severity'] {
  const lower = message.toLowerCase();
  if (lower.includes('extreme') || lower.includes('g5') || lower.includes('x-class')) return 'critical';
  if (lower.includes('severe') || lower.includes('g4') || lower.includes('g3')) return 'high';
  if (lower.includes('moderate') || lower.includes('g2') || lower.includes('m-class')) return 'moderate';
  return 'low';
}

/**
 * Classify alert type
 */
function classifyAlertType(message: string): SpaceWeatherAlert['type'] {
  const lower = message.toLowerCase();
  if (lower.includes('warning')) return 'warning';
  if (lower.includes('watch')) return 'watch';
  if (lower.includes('alert')) return 'alert';
  return 'summary';
}

/**
 * Fetch space weather data from NOAA SWPC
 */
async function fetchSpaceWeatherData(): Promise<SpaceWeatherData> {
  const [kpRes, xrayRes, alertsRes] = await Promise.allSettled([
    fetch(KP_URL, { signal: AbortSignal.timeout(10000) }),
    fetch(XRAY_URL, { signal: AbortSignal.timeout(10000) }),
    fetch(ALERTS_URL, { signal: AbortSignal.timeout(10000) }),
  ]);

  const result: SpaceWeatherData = {
    currentKp: null,
    kpLevel: 'Quiet',
    kpTrend: 'stable',
    latestFlareClass: null,
    flareIntensity: 'quiet',
    alerts: [],
    kpRecent: [],
    timestamp: new Date().toISOString(),
    source: 'noaa-swpc',
  };

  // Parse Kp index data
  if (kpRes.status === 'fulfilled' && kpRes.value.ok) {
    try {
      const kpData = await kpRes.value.json() as (string | number)[][];
      if (Array.isArray(kpData) && kpData.length > 1) {
        // First row is header, rest are data [time_tag, Kp, ...]
        const dataRows = kpData.slice(1);
        const latest = dataRows[dataRows.length - 1];
        if (latest && typeof latest[1] === 'number') {
          result.currentKp = latest[1];
          result.kpLevel = classifyKp(latest[1]);
        } else if (latest && typeof latest[1] === 'string') {
          const kpVal = parseFloat(latest[1]);
          if (!isNaN(kpVal)) {
            result.currentKp = kpVal;
            result.kpLevel = classifyKp(kpVal);
          }
        }

        // Get last 8 readings (24 hours of 3-hourly data)
        const recentRows = dataRows.slice(-8);
        result.kpRecent = recentRows
          .filter(row => row && row[0] && (typeof row[1] === 'number' || typeof row[1] === 'string'))
          .map(row => ({
            time: String(row[0]),
            kp: typeof row[1] === 'number' ? row[1] : parseFloat(String(row[1])),
          }))
          .filter(r => !isNaN(r.kp));

        result.kpTrend = getKpTrend(result.kpRecent);
      }
    } catch (e) {
      console.warn('[SpaceWeather] Failed to parse Kp data:', e);
    }
  }

  // Parse X-ray flux data
  if (xrayRes.status === 'fulfilled' && xrayRes.value.ok) {
    try {
      const xrayData = await xrayRes.value.json() as { flux?: number; time_tag?: string }[];
      if (Array.isArray(xrayData) && xrayData.length > 0) {
        // Find the most recent non-null flux reading
        for (let i = xrayData.length - 1; i >= 0; i--) {
          const reading = xrayData[i];
          if (reading?.flux && reading.flux > 0) {
            result.latestFlareClass = classifyXray(reading.flux);
            result.flareIntensity = getFlareIntensity(result.latestFlareClass);
            break;
          }
        }
      }
    } catch (e) {
      console.warn('[SpaceWeather] Failed to parse X-ray data:', e);
    }
  }

  // Parse alerts
  if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
    try {
      const alertsData = await alertsRes.value.json() as { issue_datetime?: string; message?: string }[];
      if (Array.isArray(alertsData)) {
        // Get most recent 5 alerts
        result.alerts = alertsData
          .slice(0, 10)
          .filter(a => a.message && a.issue_datetime)
          .map(a => ({
            issueTime: a.issue_datetime!,
            message: a.message!.slice(0, 200),
            type: classifyAlertType(a.message!),
            severity: classifyAlertSeverity(a.message!),
          }))
          .slice(0, 5);
      }
    } catch (e) {
      console.warn('[SpaceWeather] Failed to parse alerts:', e);
    }
  }

  return result;
}

/**
 * Public API: Fetch current space weather conditions
 */
export async function fetchSpaceWeather(): Promise<SpaceWeatherFetchResult> {
  // Check cache
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return { ok: true, data: cachedData.data };
  }

  try {
    const data = await breaker.execute(
      fetchSpaceWeatherData,
      cachedData?.data ?? emptySpaceWeatherData,
    );

    if (data && data.currentKp !== null) {
      cachedData = { data, timestamp: Date.now() };
      return { ok: true, data };
    }

    return { ok: false, data: cachedData?.data ?? null, error: 'No data available' };
  } catch (e) {
    console.error('[SpaceWeather] Fetch failed:', e);
    return { ok: false, data: cachedData?.data ?? null, error: String(e) };
  }
}

/**
 * Get severity color for UI
 */
export function getKpSeverityColor(level: KpLevel): string {
  switch (level) {
    case 'G5 Extreme': return '#ff0000';
    case 'G4 Severe': return '#ff4500';
    case 'G3 Strong': return '#ff8c00';
    case 'G2 Moderate': return '#ffd700';
    case 'G1 Minor': return '#ffff00';
    case 'Active': return '#90ee90';
    default: return '#00ff00';
  }
}

/**
 * Get Kp level icon
 */
export function getKpIcon(level: KpLevel): string {
  switch (level) {
    case 'G5 Extreme':
    case 'G4 Severe':
      return '\u{1F6A8}'; // 🚨
    case 'G3 Strong':
    case 'G2 Moderate':
      return '\u{26A0}\u{FE0F}'; // ⚠️
    case 'G1 Minor':
    case 'Active':
      return '\u{2600}\u{FE0F}'; // ☀️
    default:
      return '\u{2728}'; // ✨
  }
}

/**
 * Format Kp value for display
 */
export function formatKp(kp: number | null): string {
  if (kp === null) return '--';
  return kp.toFixed(1);
}
