/**
 * Health Outbreaks Service
 *
 * Aggregates disease outbreak alerts from:
 * - WHO (World Health Organization) RSS
 * - CDC (Centers for Disease Control) RSS
 * - Outbreak News Today RSS
 *
 * Identifies high-concern pathogens (Ebola, H5N1, Mpox, etc.)
 * All feeds are free and require no API key.
 */

import { createCircuitBreaker } from '@/utils';
import { fetchWithProxy } from '@/utils';

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// RSS Feed sources
const HEALTH_FEEDS: { name: string; url: string; org: string }[] = [
  { name: 'WHO', url: 'https://www.who.int/rss-feeds/news-english.xml', org: 'WHO' },
  { name: 'CDC', url: 'https://tools.cdc.gov/api/v2/resources/media/132608.rss', org: 'CDC' },
  { name: 'Outbreak News', url: 'https://outbreaknewstoday.com/feed/', org: 'ONT' },
];

// High-concern pathogens to flag
const HIGH_CONCERN_PATHOGENS: string[] = [
  'ebola', 'marburg', 'mpox', 'monkeypox', 'h5n1', 'avian influenza', 'bird flu',
  'nipah', 'mers', 'sars', 'cholera', 'plague', 'anthrax',
  'polio', 'yellow fever', 'hantavirus', 'lassa', 'rift valley',
  'dengue', 'zika', 'chikungunya', 'covid', 'measles', 'tuberculosis',
];

export interface HealthOutbreak {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  summary: string;
  organization: string;
  isHighConcern: boolean;
  pathogensDetected: string[];
  severity: 'critical' | 'high' | 'moderate' | 'low';
}

export interface HealthOutbreaksData {
  items: HealthOutbreak[];
  count: number;
  highConcernCount: number;
  byOrganization: Record<string, number>;
  timestamp: string;
  source: 'health-feeds';
}

export interface HealthOutbreaksFetchResult {
  ok: boolean;
  data: HealthOutbreaksData | null;
  error?: string;
}

// Circuit breaker for reliability
const breaker = createCircuitBreaker<HealthOutbreaksData>({
  name: 'Health Outbreaks',
  cacheTtlMs: CACHE_TTL,
  persistCache: true,
});

// Cache
let cachedData: { data: HealthOutbreaksData; timestamp: number } | null = null;

// Default empty data for fallback
const emptyHealthOutbreaksData: HealthOutbreaksData = {
  items: [],
  count: 0,
  highConcernCount: 0,
  byOrganization: {},
  timestamp: new Date().toISOString(),
  source: 'health-feeds',
};

/**
 * Check if text mentions high-concern pathogens
 */
function detectPathogens(text: string): { isHighConcern: boolean; pathogens: string[] } {
  const lower = text.toLowerCase();
  const matched = HIGH_CONCERN_PATHOGENS.filter(p => lower.includes(p));
  return {
    isHighConcern: matched.length > 0,
    pathogens: matched,
  };
}

/**
 * Determine severity based on content
 */
function determineSeverity(title: string, pathogens: string[]): HealthOutbreak['severity'] {
  const lower = title.toLowerCase();

  // Critical: deadly pathogens or outbreak keywords
  const criticalPathogens = ['ebola', 'marburg', 'nipah', 'plague', 'anthrax'];
  if (criticalPathogens.some(p => pathogens.includes(p))) return 'critical';
  if (lower.includes('outbreak') && lower.includes('death')) return 'critical';
  if (lower.includes('pandemic') || lower.includes('emergency')) return 'critical';

  // High: concerning pathogens
  const highPathogens = ['h5n1', 'avian influenza', 'mers', 'cholera', 'mpox'];
  if (highPathogens.some(p => pathogens.includes(p))) return 'high';
  if (lower.includes('outbreak')) return 'high';

  // Moderate: other high-concern pathogens
  if (pathogens.length > 0) return 'moderate';

  // Low: general health news
  return 'low';
}

/**
 * Generate a stable ID from URL
 */
function generateId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `health-${Math.abs(hash).toString(36)}`;
}

/**
 * Parse RSS feed XML
 */
function parseRssFeed(xml: string, feedInfo: { name: string; org: string }): HealthOutbreak[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.warn(`[HealthOutbreaks] Parse error for ${feedInfo.name}`);
    return [];
  }

  // Try RSS format first
  let items = doc.querySelectorAll('item');
  const isAtom = items.length === 0;
  if (isAtom) {
    items = doc.querySelectorAll('entry');
  }

  const results: HealthOutbreak[] = [];

  Array.from(items).slice(0, 15).forEach(item => {
    const title = item.querySelector('title')?.textContent?.trim() || '';
    if (!title) return;

    let link = '';
    if (isAtom) {
      const linkEl = item.querySelector('link[href]');
      link = linkEl?.getAttribute('href') || '';
    } else {
      link = item.querySelector('link')?.textContent?.trim() || '';
    }

    const pubDateStr = isAtom
      ? (item.querySelector('published')?.textContent || item.querySelector('updated')?.textContent || '')
      : (item.querySelector('pubDate')?.textContent || '');

    const publishedAt = pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString();

    const description = item.querySelector('description')?.textContent?.trim() || '';
    const summary = description.replace(/<[^>]*>/g, '').slice(0, 200);

    const { isHighConcern, pathogens } = detectPathogens(`${title} ${description}`);
    const severity = determineSeverity(title, pathogens);

    results.push({
      id: generateId(link || title),
      title,
      link,
      publishedAt,
      summary,
      organization: feedInfo.org,
      isHighConcern,
      pathogensDetected: pathogens,
      severity,
    });
  });

  return results;
}

/**
 * Fetch a single RSS feed
 */
async function fetchFeed(feedInfo: { name: string; url: string; org: string }): Promise<HealthOutbreak[]> {
  try {
    const response = await fetchWithProxy(feedInfo.url);
    if (!response.ok) {
      console.warn(`[HealthOutbreaks] HTTP ${response.status} for ${feedInfo.name}`);
      return [];
    }
    const xml = await response.text();
    return parseRssFeed(xml, feedInfo);
  } catch (e) {
    console.warn(`[HealthOutbreaks] Failed to fetch ${feedInfo.name}:`, e);
    return [];
  }
}

/**
 * Fetch all health outbreak data
 */
async function fetchHealthOutbreaksData(): Promise<HealthOutbreaksData> {
  const results = await Promise.allSettled(
    HEALTH_FEEDS.map(feed => fetchFeed(feed))
  );

  const allItems: HealthOutbreak[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // Sort by published date (newest first), then by severity
  allItems.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  // Take top 30
  const items = allItems.slice(0, 30);

  // Count by organization
  const byOrganization: Record<string, number> = {};
  for (const item of items) {
    byOrganization[item.organization] = (byOrganization[item.organization] || 0) + 1;
  }

  return {
    items,
    count: items.length,
    highConcernCount: items.filter(i => i.isHighConcern).length,
    byOrganization,
    timestamp: new Date().toISOString(),
    source: 'health-feeds',
  };
}

/**
 * Public API: Fetch health outbreaks data
 */
export async function fetchHealthOutbreaks(): Promise<HealthOutbreaksFetchResult> {
  // Check cache
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return { ok: true, data: cachedData.data };
  }

  try {
    const data = await breaker.execute(
      fetchHealthOutbreaksData,
      cachedData?.data ?? emptyHealthOutbreaksData,
    );

    if (data && data.items.length > 0) {
      cachedData = { data, timestamp: Date.now() };
      return { ok: true, data };
    }

    return { ok: false, data: cachedData?.data ?? null, error: 'No data available' };
  } catch (e) {
    console.error('[HealthOutbreaks] Fetch failed:', e);
    return { ok: false, data: cachedData?.data ?? null, error: String(e) };
  }
}

/**
 * Get severity color for UI
 */
export function getSeverityColor(severity: HealthOutbreak['severity']): string {
  switch (severity) {
    case 'critical': return '#ff0000';
    case 'high': return '#ff4500';
    case 'moderate': return '#ffa500';
    default: return '#4caf50';
  }
}

/**
 * Get severity icon
 */
export function getSeverityIcon(severity: HealthOutbreak['severity']): string {
  switch (severity) {
    case 'critical': return '\u{1F6A8}'; // 🚨
    case 'high': return '\u{26A0}\u{FE0F}'; // ⚠️
    case 'moderate': return '\u{1F9EA}'; // 🧪
    default: return '\u{1F4DD}'; // 📝
  }
}
