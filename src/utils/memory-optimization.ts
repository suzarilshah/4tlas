/**
 * Memory Optimization Utilities
 *
 * Provides LRU caches, memory monitoring, and cleanup utilities
 * to prevent unbounded memory growth in the application.
 */

// ─── LRU Cache Implementation ────────────────────────────────────────────────

interface LRUCacheOptions<K, V> {
  maxSize: number;
  maxAge?: number; // Max age in milliseconds
  onEvict?: (key: K, value: V) => void;
}

interface CacheEntry<V> {
  value: V;
  timestamp: number;
}

/**
 * LRU (Least Recently Used) Cache with TTL support
 * Automatically evicts old entries when max size is reached
 */
export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly maxAge: number;
  private readonly onEvict?: (key: K, value: V) => void;

  constructor(options: LRUCacheOptions<K, V>) {
    this.maxSize = options.maxSize;
    this.maxAge = options.maxAge ?? Infinity;
    this.onEvict = options.onEvict;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Delete existing entry first (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldEntry = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        if (oldEntry && this.onEvict) {
          this.onEvict(oldestKey, oldEntry.value);
        }
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry && this.onEvict) {
      this.onEvict(key, entry.value);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache) {
        this.onEvict(key, entry.value);
      }
    }
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  /** Remove expired entries */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.maxAge) {
        this.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

// ─── Bounded Map/Set Wrappers ────────────────────────────────────────────────

/**
 * A Map that automatically limits its size by removing oldest entries
 */
export class BoundedMap<K, V> extends Map<K, V> {
  private readonly maxSize: number;

  constructor(maxSize: number, entries?: Iterable<readonly [K, V]>) {
    super(entries);
    this.maxSize = maxSize;
    this.enforceLimit();
  }

  set(key: K, value: V): this {
    // Delete first to update insertion order
    if (this.has(key)) {
      this.delete(key);
    }
    super.set(key, value);
    this.enforceLimit();
    return this;
  }

  private enforceLimit(): void {
    while (this.size > this.maxSize) {
      const oldestKey = this.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
      }
    }
  }
}

/**
 * A Set that automatically limits its size by removing oldest entries
 */
export class BoundedSet<T> extends Set<T> {
  private readonly maxSize: number;

  constructor(maxSize: number, values?: Iterable<T>) {
    super(values);
    this.maxSize = maxSize;
    this.enforceLimit();
  }

  add(value: T): this {
    // Delete first to update insertion order
    if (this.has(value)) {
      this.delete(value);
    }
    super.add(value);
    this.enforceLimit();
    return this;
  }

  private enforceLimit(): void {
    while (this.size > this.maxSize) {
      const oldestValue = this.values().next().value;
      if (oldestValue !== undefined) {
        this.delete(oldestValue);
      }
    }
  }
}

// ─── Memory Monitoring ───────────────────────────────────────────────────────

export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usedMB: number;
  totalMB: number;
  limitMB: number;
  usagePercent: number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Get current memory statistics (Chrome/Edge only)
 */
export function getMemoryStats(): MemoryStats | null {
  const perf = performance as Performance & { memory?: PerformanceMemory };
  if (!perf.memory) return null;

  const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perf.memory;
  return {
    usedJSHeapSize,
    totalJSHeapSize,
    jsHeapSizeLimit,
    usedMB: Math.round(usedJSHeapSize / 1024 / 1024),
    totalMB: Math.round(totalJSHeapSize / 1024 / 1024),
    limitMB: Math.round(jsHeapSizeLimit / 1024 / 1024),
    usagePercent: Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100),
  };
}

/**
 * Check if memory usage is above threshold
 */
export function isMemoryPressure(thresholdPercent = 70): boolean {
  const stats = getMemoryStats();
  if (!stats) return false;
  return stats.usagePercent > thresholdPercent;
}

// ─── Global Cache Registry ───────────────────────────────────────────────────

interface RegisteredCache {
  name: string;
  getSize: () => number;
  clear: () => void;
  prune?: () => number;
}

const registeredCaches: RegisteredCache[] = [];

/**
 * Register a cache for global memory management
 */
export function registerCache(cache: RegisteredCache): void {
  registeredCaches.push(cache);
}

/**
 * Unregister a cache
 */
export function unregisterCache(name: string): void {
  const idx = registeredCaches.findIndex(c => c.name === name);
  if (idx !== -1) registeredCaches.splice(idx, 1);
}

/**
 * Get total size of all registered caches
 */
export function getTotalCacheSize(): number {
  return registeredCaches.reduce((sum, cache) => sum + cache.getSize(), 0);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): Array<{ name: string; size: number }> {
  return registeredCaches.map(cache => ({
    name: cache.name,
    size: cache.getSize(),
  }));
}

/**
 * Prune all registered caches (remove expired entries)
 */
export function pruneAllCaches(): number {
  let total = 0;
  for (const cache of registeredCaches) {
    if (cache.prune) {
      total += cache.prune();
    }
  }
  return total;
}

/**
 * Clear all registered caches (emergency memory release)
 */
export function clearAllCaches(): void {
  for (const cache of registeredCaches) {
    cache.clear();
  }
}

// ─── Memory Pressure Handler ─────────────────────────────────────────────────

type MemoryPressureCallback = (stats: MemoryStats) => void;
const pressureCallbacks: MemoryPressureCallback[] = [];
let memoryMonitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Subscribe to memory pressure events
 */
export function onMemoryPressure(callback: MemoryPressureCallback): () => void {
  pressureCallbacks.push(callback);
  return () => {
    const idx = pressureCallbacks.indexOf(callback);
    if (idx !== -1) pressureCallbacks.splice(idx, 1);
  };
}

/**
 * Start monitoring memory and trigger callbacks when pressure is detected
 */
export function startMemoryMonitor(
  intervalMs = 15000,
  thresholdPercent = 50
): void {
  if (memoryMonitorInterval) return;

  memoryMonitorInterval = setInterval(() => {
    const stats = getMemoryStats();
    if (!stats) return;

    if (stats.usagePercent > thresholdPercent) {
      console.warn(
        `[Memory] High usage detected: ${stats.usedMB}MB / ${stats.limitMB}MB (${stats.usagePercent}%)`
      );

      const pruned = pruneAllCaches();
      if (pruned > 0) {
        console.info(`[Memory] Pruned ${pruned} stale cache entries`);
      }

      // Critical threshold: clear everything non-essential
      if (stats.usagePercent > 70) {
        console.warn('[Memory] Critical threshold reached, clearing all caches');
        clearAllCaches();
      }

      for (const cb of pressureCallbacks) {
        try {
          cb(stats);
        } catch (e) {
          console.error('[Memory] Pressure callback error:', e);
        }
      }
    }
  }, intervalMs);
}

/**
 * Stop memory monitoring
 */
export function stopMemoryMonitor(): void {
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = null;
  }
}

// ─── Array/Object Size Limiters ──────────────────────────────────────────────

/**
 * Trim an array to a maximum size, keeping the most recent items
 */
export function trimArray<T>(arr: T[], maxSize: number): T[] {
  if (arr.length <= maxSize) return arr;
  return arr.slice(-maxSize);
}

/**
 * Trim an array in-place to a maximum size
 */
export function trimArrayInPlace<T>(arr: T[], maxSize: number): void {
  if (arr.length > maxSize) {
    arr.splice(0, arr.length - maxSize);
  }
}

/**
 * Limit object keys to a maximum count
 */
export function limitObjectKeys<T>(
  obj: Record<string, T>,
  maxKeys: number
): Record<string, T> {
  const keys = Object.keys(obj);
  if (keys.length <= maxKeys) return obj;

  const result: Record<string, T> = {};
  const keysToKeep = keys.slice(-maxKeys);
  for (const key of keysToKeep) {
    result[key] = obj[key]!;
  }
  return result;
}

// ─── Debounced Cleanup ───────────────────────────────────────────────────────

/**
 * Create a cleanup function that only runs after a delay
 * Useful for batching cleanup operations
 */
export function createDebouncedCleanup(
  cleanupFn: () => void,
  delayMs = 5000
): { trigger: () => void; cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger: () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        cleanupFn();
      }, delayMs);
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    flush: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        cleanupFn();
      }
    },
  };
}

// ─── Console Memory Logger ───────────────────────────────────────────────────

/**
 * Log current memory status to console (for debugging)
 */
export function logMemoryStatus(): void {
  const stats = getMemoryStats();
  if (!stats) {
    console.log('[Memory] Stats not available (non-Chrome browser)');
    return;
  }

  console.group('[Memory] Status');
  console.log(`Used: ${stats.usedMB}MB`);
  console.log(`Total Allocated: ${stats.totalMB}MB`);
  console.log(`Limit: ${stats.limitMB}MB`);
  console.log(`Usage: ${stats.usagePercent}%`);
  console.log('Registered Caches:');
  for (const { name, size } of getCacheStats()) {
    console.log(`  - ${name}: ${size} entries`);
  }
  console.log(`Total Cache Entries: ${getTotalCacheSize()}`);
  console.groupEnd();
}

// ─── Emergency Memory Release ────────────────────────────────────────────────

type EmergencyReleaseCallback = () => void;
const emergencyCallbacks: EmergencyReleaseCallback[] = [];

/**
 * Register a callback for emergency memory release (e.g., clearing large data arrays)
 */
export function onEmergencyRelease(callback: EmergencyReleaseCallback): () => void {
  emergencyCallbacks.push(callback);
  return () => {
    const idx = emergencyCallbacks.indexOf(callback);
    if (idx !== -1) emergencyCallbacks.splice(idx, 1);
  };
}

/**
 * Trigger emergency memory release - clears all caches and runs registered callbacks
 */
export function releaseMemory(): void {
  console.warn('[Memory] Emergency release triggered');
  clearAllCaches();
  for (const cb of emergencyCallbacks) {
    try { cb(); } catch (e) { console.error('[Memory] Emergency release callback error:', e); }
  }
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__memoryDebug = {
    getStats: getMemoryStats,
    logStatus: logMemoryStatus,
    getCaches: getCacheStats,
    pruneAll: pruneAllCaches,
    clearAll: clearAllCaches,
    release: releaseMemory,
  };
}
