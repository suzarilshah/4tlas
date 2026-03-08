/**
 * Performance Optimizer Service
 *
 * Provides utilities for optimizing app performance:
 * - Lazy loading of heavy components
 * - Image optimization
 * - Idle-time cleanup
 * - Memory pressure handling
 */

import { isMemoryPressure, pruneAllCaches, onMemoryPressure, getMemoryStats } from '@/utils/memory-optimization';

// ─── Lazy Loading Utilities ──────────────────────────────────────────────────

interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
  onVisible?: () => void;
}

const lazyObservers = new Map<Element, IntersectionObserver>();

/**
 * Lazy load an element's content when it becomes visible
 */
export function lazyLoad(
  element: Element,
  loadFn: () => void | Promise<void>,
  options: LazyLoadOptions = {}
): () => void {
  const { rootMargin = '200px', threshold = 0.1, onVisible } = options;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();
          lazyObservers.delete(element);
          void loadFn();
          onVisible?.();
        }
      }
    },
    { rootMargin, threshold }
  );

  observer.observe(element);
  lazyObservers.set(element, observer);

  return () => {
    observer.disconnect();
    lazyObservers.delete(element);
  };
}

/**
 * Cleanup all lazy observers
 */
export function cleanupLazyObservers(): void {
  for (const observer of lazyObservers.values()) {
    observer.disconnect();
  }
  lazyObservers.clear();
}

// ─── Idle Time Utilities ─────────────────────────────────────────────────────

type IdleCallback = () => void;
const idleCallbacks: IdleCallback[] = [];
let idleCallbackId: number | null = null;

/**
 * Schedule a callback to run when browser is idle
 */
export function runWhenIdle(callback: IdleCallback, timeout = 5000): void {
  if ('requestIdleCallback' in window) {
    idleCallbackId = window.requestIdleCallback(
      () => {
        callback();
        idleCallbackId = null;
      },
      { timeout }
    );
  } else {
    // Fallback for Safari
    setTimeout(callback, 100);
  }
}

/**
 * Queue a cleanup task for idle time
 */
export function queueIdleCleanup(callback: IdleCallback): void {
  idleCallbacks.push(callback);
  scheduleIdleCleanup();
}

let idleCleanupScheduled = false;

function scheduleIdleCleanup(): void {
  if (idleCleanupScheduled) return;
  idleCleanupScheduled = true;

  runWhenIdle(() => {
    idleCleanupScheduled = false;
    const callback = idleCallbacks.shift();
    if (callback) {
      try {
        callback();
      } catch (e) {
        console.error('[Performance] Idle cleanup error:', e);
      }
    }
    if (idleCallbacks.length > 0) {
      scheduleIdleCleanup();
    }
  });
}

// ─── Image Optimization ──────────────────────────────────────────────────────

/**
 * Load image with lazy loading support
 */
export function createLazyImage(
  src: string,
  alt: string,
  className?: string
): HTMLImageElement {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = src;
  img.alt = alt;
  if (className) img.className = className;
  return img;
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Memory Pressure Handler ─────────────────────────────────────────────────

let memoryPressureUnsubscribe: (() => void) | null = null;

interface MemoryPressureHandler {
  name: string;
  priority: number; // Lower = run first
  handler: () => void;
}

const pressureHandlers: MemoryPressureHandler[] = [];

/**
 * Register a handler to run when memory pressure is detected
 */
export function registerMemoryPressureHandler(
  name: string,
  handler: () => void,
  priority = 50
): () => void {
  const entry = { name, handler, priority };
  pressureHandlers.push(entry);
  pressureHandlers.sort((a, b) => a.priority - b.priority);

  return () => {
    const idx = pressureHandlers.indexOf(entry);
    if (idx !== -1) pressureHandlers.splice(idx, 1);
  };
}

/**
 * Initialize memory pressure monitoring
 */
export function initMemoryPressureHandling(): void {
  if (memoryPressureUnsubscribe) return;

  memoryPressureUnsubscribe = onMemoryPressure((stats) => {
    console.warn(`[Performance] Memory pressure detected: ${stats.usedMB}MB (${stats.usagePercent}%)`);

    // Run registered handlers
    for (const { name, handler } of pressureHandlers) {
      try {
        console.log(`[Performance] Running pressure handler: ${name}`);
        handler();
      } catch (e) {
        console.error(`[Performance] Handler ${name} failed:`, e);
      }
    }

    // Always prune caches
    const pruned = pruneAllCaches();
    console.log(`[Performance] Pruned ${pruned} cache entries`);
  });

  // Register default handlers
  registerMemoryPressureHandler('gc-hint', () => {
    // Create temporary arrays to hint GC (best effort)
    const temp: unknown[] = [];
    for (let i = 0; i < 1000; i++) temp.push({});
  }, 100);
}

/**
 * Stop memory pressure monitoring
 */
export function stopMemoryPressureHandling(): void {
  memoryPressureUnsubscribe?.();
  memoryPressureUnsubscribe = null;
  pressureHandlers.length = 0;
}

// ─── Debounced Scroll Handler ────────────────────────────────────────────────

/**
 * Create a debounced scroll handler that batches updates
 */
export function createScrollHandler(
  callback: (scrollTop: number, scrollHeight: number, clientHeight: number) => void,
  element: HTMLElement | Window = window
): () => void {
  let ticking = false;

  const handleScroll = (): void => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      ticking = false;
      if (element === window) {
        callback(
          window.scrollY,
          document.documentElement.scrollHeight,
          window.innerHeight
        );
      } else {
        const el = element as HTMLElement;
        callback(el.scrollTop, el.scrollHeight, el.clientHeight);
      }
    });
  };

  element.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    element.removeEventListener('scroll', handleScroll);
  };
}

// ─── Animation Frame Throttling ──────────────────────────────────────────────

/**
 * Throttle a function to run at most once per animation frame
 */
export function rafThrottle<T extends (...args: unknown[]) => void>(
  fn: T
): T & { cancel: () => void } {
  let rafId: number | null = null;
  let lastArgs: unknown[] | null = null;

  const throttled = ((...args: unknown[]) => {
    lastArgs = args;
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
    });
  }) as T & { cancel: () => void };

  throttled.cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
}

// ─── DOM Batch Updates ───────────────────────────────────────────────────────

let batchedUpdates: (() => void)[] = [];
let batchRafId: number | null = null;

/**
 * Batch DOM updates to run in a single animation frame
 */
export function batchDOMUpdate(update: () => void): void {
  batchedUpdates.push(update);

  if (batchRafId) return;

  batchRafId = requestAnimationFrame(() => {
    batchRafId = null;
    const updates = batchedUpdates;
    batchedUpdates = [];

    for (const fn of updates) {
      try {
        fn();
      } catch (e) {
        console.error('[Performance] Batch update error:', e);
      }
    }
  });
}

// ─── Performance Metrics ─────────────────────────────────────────────────────

interface PerformanceMetrics {
  heapUsed: number;
  heapLimit: number;
  usagePercent: number;
  fps: number;
  longTasks: number;
}

let fpsFrames = 0;
let fpsLastTime = performance.now();
let currentFps = 60;
let longTaskCount = 0;
let fpsRafId: number | null = null;

function updateFps(): void {
  fpsFrames++;
  const now = performance.now();
  const elapsed = now - fpsLastTime;

  if (elapsed >= 1000) {
    currentFps = Math.round((fpsFrames * 1000) / elapsed);
    fpsFrames = 0;
    fpsLastTime = now;
  }

  fpsRafId = requestAnimationFrame(updateFps);
}

/**
 * Start FPS monitoring
 */
export function startFpsMonitoring(): void {
  if (fpsRafId) return;
  fpsRafId = requestAnimationFrame(updateFps);

  // Monitor long tasks
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            longTaskCount++;
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // longtask not supported
    }
  }
}

/**
 * Stop FPS monitoring
 */
export function stopFpsMonitoring(): void {
  if (fpsRafId) {
    cancelAnimationFrame(fpsRafId);
    fpsRafId = null;
  }
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  const memStats = getMemoryStats();
  return {
    heapUsed: memStats?.usedMB ?? 0,
    heapLimit: memStats?.limitMB ?? 0,
    usagePercent: memStats?.usagePercent ?? 0,
    fps: currentFps,
    longTasks: longTaskCount,
  };
}

// ─── Initialize ──────────────────────────────────────────────────────────────

/**
 * Initialize all performance optimizations
 */
export function initPerformanceOptimizer(): void {
  initMemoryPressureHandling();
  startFpsMonitoring();

  // Log performance status periodically in development
  if (import.meta.env.DEV) {
    setInterval(() => {
      if (isMemoryPressure(60)) {
        const metrics = getPerformanceMetrics();
        console.warn('[Performance] Warning:', metrics);
      }
    }, 30000);
  }
}

/**
 * Cleanup performance optimizer
 */
export function cleanupPerformanceOptimizer(): void {
  stopMemoryPressureHandling();
  stopFpsMonitoring();
  cleanupLazyObservers();

  if (idleCallbackId && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(idleCallbackId);
  }
}

// Export for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__perfOptimizer = {
    metrics: getPerformanceMetrics,
    startFps: startFpsMonitoring,
    stopFps: stopFpsMonitoring,
    isMemoryPressure,
  };
}
