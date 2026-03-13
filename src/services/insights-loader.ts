import { getHydratedData } from '@/services/bootstrap';
import { toRuntimeUrl } from '@/services/runtime';

export interface ServerInsightStory {
  primaryTitle: string;
  primarySource: string;
  primaryLink: string;
  sourceCount: number;
  importanceScore: number;
  velocity: { level: string; sourcesPerHour: number };
  isAlert: boolean;
  category: string;
  threatLevel: string;
}

export interface ServerInsights {
  worldBrief: string;
  briefProvider: string;
  status: 'ok' | 'degraded';
  topStories: ServerInsightStory[];
  generatedAt: string;
  clusterCount: number;
  multiSourceCount: number;
  fastMovingCount: number;
}

let cached: ServerInsights | null = null;
let fetchPromise: Promise<ServerInsights | null> | null = null;
const MAX_AGE_MS = 15 * 60 * 1000;

function isFresh(data: ServerInsights): boolean {
  const age = Date.now() - new Date(data.generatedAt).getTime();
  return age < MAX_AGE_MS;
}

async function fetchInsightsFromApi(): Promise<ServerInsights | null> {
  try {
    const resp = await fetch(toRuntimeUrl('/api/intelligence/v1/list-insights'), {
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as ServerInsights;
    if (!Array.isArray(data.topStories) || data.topStories.length === 0) return null;
    if (typeof data.generatedAt !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function getServerInsights(): ServerInsights | null {
  if (cached && isFresh(cached)) {
    return cached;
  }
  cached = null;

  // Try bootstrap hydration first
  const raw = getHydratedData('insights');
  if (raw && typeof raw === 'object') {
    const data = raw as ServerInsights;
    if (Array.isArray(data.topStories) && data.topStories.length > 0 &&
        typeof data.generatedAt === 'string' && isFresh(data)) {
      cached = data;
      return data;
    }
  }

  // Bootstrap empty - trigger async fetch for next call
  if (!fetchPromise) {
    fetchPromise = fetchInsightsFromApi().then(data => {
      fetchPromise = null;
      if (data && isFresh(data)) {
        cached = data;
      }
      return data;
    });
  }

  return null;
}

export async function getServerInsightsAsync(): Promise<ServerInsights | null> {
  // Return cached if fresh
  if (cached && isFresh(cached)) {
    return cached;
  }

  // Try bootstrap hydration
  const raw = getHydratedData('insights');
  if (raw && typeof raw === 'object') {
    const data = raw as ServerInsights;
    if (Array.isArray(data.topStories) && data.topStories.length > 0 &&
        typeof data.generatedAt === 'string' && isFresh(data)) {
      cached = data;
      return data;
    }
  }

  // Fetch from API
  const data = await fetchInsightsFromApi();
  if (data && isFresh(data)) {
    cached = data;
  }
  return data;
}

export function setServerInsights(data: ServerInsights): void {
  cached = data;
}
