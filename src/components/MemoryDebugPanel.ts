/**
 * Memory Debug Panel
 *
 * A floating panel that shows real-time memory statistics.
 * Toggle with: window.memoryDebug.panel()
 */

import { getMemoryStats, getCacheStats, pruneAllCaches, clearAllCaches } from '@/utils/memory-optimization';

let panelInstance: MemoryDebugPanel | null = null;

export class MemoryDebugPanel {
  private container: HTMLElement;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isVisible = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'memory-debug-panel';
    this.container.innerHTML = `
      <style>
        #memory-debug-panel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 320px;
          background: rgba(0, 0, 0, 0.9);
          color: #00ff00;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          font-size: 11px;
          padding: 12px;
          border-radius: 8px;
          z-index: 99999;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          display: none;
        }
        #memory-debug-panel.visible {
          display: block;
        }
        #memory-debug-panel .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #333;
        }
        #memory-debug-panel .title {
          font-weight: bold;
          font-size: 12px;
        }
        #memory-debug-panel .close-btn {
          cursor: pointer;
          padding: 2px 6px;
          background: #333;
          border-radius: 4px;
        }
        #memory-debug-panel .close-btn:hover {
          background: #444;
        }
        #memory-debug-panel .stat-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        #memory-debug-panel .stat-label {
          color: #888;
        }
        #memory-debug-panel .stat-value {
          font-weight: bold;
        }
        #memory-debug-panel .stat-value.warning {
          color: #ffaa00;
        }
        #memory-debug-panel .stat-value.danger {
          color: #ff4444;
        }
        #memory-debug-panel .progress-bar {
          height: 6px;
          background: #222;
          border-radius: 3px;
          margin: 8px 0;
          overflow: hidden;
        }
        #memory-debug-panel .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00ff00, #ffaa00, #ff4444);
          transition: width 0.3s ease;
        }
        #memory-debug-panel .section-title {
          color: #666;
          font-size: 10px;
          text-transform: uppercase;
          margin-top: 10px;
          margin-bottom: 6px;
        }
        #memory-debug-panel .actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        #memory-debug-panel .action-btn {
          flex: 1;
          padding: 6px 10px;
          background: #222;
          border: 1px solid #444;
          color: #00ff00;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          font-family: inherit;
        }
        #memory-debug-panel .action-btn:hover {
          background: #333;
        }
        #memory-debug-panel .action-btn.danger {
          border-color: #ff4444;
          color: #ff4444;
        }
        #memory-debug-panel .caches-list {
          max-height: 100px;
          overflow-y: auto;
          font-size: 10px;
        }
      </style>
      <div class="header">
        <span class="title">Memory Monitor</span>
        <span class="close-btn" id="mem-close">X</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Heap Used</span>
        <span class="stat-value" id="mem-used">--</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Heap Total</span>
        <span class="stat-value" id="mem-total">--</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Heap Limit</span>
        <span class="stat-value" id="mem-limit">--</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="mem-progress" style="width: 0%"></div>
      </div>
      <div class="stat-row">
        <span class="stat-label">Usage</span>
        <span class="stat-value" id="mem-percent">--%</span>
      </div>
      <div class="section-title">WebGL/GPU</div>
      <div class="stat-row">
        <span class="stat-label">Geometries</span>
        <span class="stat-value" id="mem-geometries">--</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Textures</span>
        <span class="stat-value" id="mem-textures">--</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Draw Calls</span>
        <span class="stat-value" id="mem-drawcalls">--</span>
      </div>
      <div class="section-title">Registered Caches</div>
      <div class="caches-list" id="mem-caches"></div>
      <div class="actions">
        <button class="action-btn" id="mem-prune">Prune Stale</button>
        <button class="action-btn danger" id="mem-clear">Clear All</button>
        <button class="action-btn" id="mem-gc">Force GC</button>
      </div>
    `;

    document.body.appendChild(this.container);

    // Event listeners
    this.container.querySelector('#mem-close')?.addEventListener('click', () => this.hide());
    this.container.querySelector('#mem-prune')?.addEventListener('click', () => {
      const pruned = pruneAllCaches();
      console.log(`[Memory] Pruned ${pruned} cache entries`);
      this.update();
    });
    this.container.querySelector('#mem-clear')?.addEventListener('click', () => {
      clearAllCaches();
      console.log('[Memory] Cleared all caches');
      this.update();
    });
    this.container.querySelector('#mem-gc')?.addEventListener('click', () => {
      // Attempt to trigger GC via memory pressure (best effort)
      if ((window as unknown as { gc?: () => void }).gc) {
        (window as unknown as { gc: () => void }).gc();
        console.log('[Memory] GC triggered');
      } else {
        console.log('[Memory] Manual GC not available (run Chrome with --js-flags="--expose-gc")');
      }
      this.update();
    });
  }

  show(): void {
    this.container.classList.add('visible');
    this.isVisible = true;
    this.update();
    this.intervalId = setInterval(() => this.update(), 2000);
  }

  hide(): void {
    this.container.classList.remove('visible');
    this.isVisible = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private update(): void {
    const stats = getMemoryStats();
    const caches = getCacheStats();

    const usedEl = this.container.querySelector('#mem-used');
    const totalEl = this.container.querySelector('#mem-total');
    const limitEl = this.container.querySelector('#mem-limit');
    const percentEl = this.container.querySelector('#mem-percent');
    const progressEl = this.container.querySelector('#mem-progress') as HTMLElement;
    const cachesEl = this.container.querySelector('#mem-caches');
    const geometriesEl = this.container.querySelector('#mem-geometries');
    const texturesEl = this.container.querySelector('#mem-textures');
    const drawCallsEl = this.container.querySelector('#mem-drawcalls');

    if (stats) {
      if (usedEl) usedEl.textContent = `${stats.usedMB} MB`;
      if (totalEl) totalEl.textContent = `${stats.totalMB} MB`;
      if (limitEl) limitEl.textContent = `${stats.limitMB} MB`;
      if (percentEl) {
        percentEl.textContent = `${stats.usagePercent}%`;
        percentEl.className = 'stat-value';
        if (stats.usagePercent > 80) {
          percentEl.classList.add('danger');
        } else if (stats.usagePercent > 60) {
          percentEl.classList.add('warning');
        }
      }
      if (progressEl) {
        progressEl.style.width = `${stats.usagePercent}%`;
      }
    } else {
      if (usedEl) usedEl.textContent = 'N/A';
      if (totalEl) totalEl.textContent = 'N/A';
      if (limitEl) limitEl.textContent = 'N/A';
      if (percentEl) percentEl.textContent = 'N/A';
    }

    // Try to get WebGL/Three.js stats from globe renderer
    const webglInfo = this.getWebGLStats();
    if (geometriesEl) geometriesEl.textContent = webglInfo.geometries?.toString() ?? '--';
    if (texturesEl) texturesEl.textContent = webglInfo.textures?.toString() ?? '--';
    if (drawCallsEl) drawCallsEl.textContent = webglInfo.drawCalls?.toString() ?? '--';

    if (cachesEl) {
      if (caches.length === 0) {
        cachesEl.innerHTML = '<div style="color: #666;">No caches registered</div>';
      } else {
        cachesEl.innerHTML = caches
          .map(c => `<div class="stat-row"><span class="stat-label">${c.name}</span><span>${c.size}</span></div>`)
          .join('');
      }
    }
  }

  private getWebGLStats(): { geometries?: number; textures?: number; drawCalls?: number } {
    try {
      // Try to access the app's map container
      const appCtx = (window as unknown as { __appContext?: { map?: { getRendererInfo?: () => { geometries: number; textures: number; calls: number } } } }).__appContext;
      if (appCtx?.map?.getRendererInfo) {
        const info = appCtx.map.getRendererInfo();
        return { geometries: info.geometries, textures: info.textures, drawCalls: info.calls };
      }
      return {};
    } catch {
      return {};
    }
  }

  destroy(): void {
    this.hide();
    this.container.remove();
  }
}

/**
 * Toggle the memory debug panel
 */
export function toggleMemoryPanel(): void {
  if (!panelInstance) {
    panelInstance = new MemoryDebugPanel();
  }
  panelInstance.toggle();
}

// Expose to window
if (typeof window !== 'undefined') {
  const memDebug = (window as unknown as Record<string, unknown>).memoryDebug;
  if (memDebug && typeof memDebug === 'object') {
    (memDebug as Record<string, unknown>).panel = toggleMemoryPanel;
  }
}
