/**
 * ATLAS Panel Wrapper
 * Wraps the AtlasPanel for integration with World Monitor's panel system
 */

import { Panel } from './Panel';
import { renderAtlasPanel, initAtlasPanel } from './AtlasPanel';

export class AtlasPanelWrapper extends Panel {
  private initialized = false;

  constructor() {
    super({
      id: 'atlas',
      title: 'ATLAS Intelligence',
      className: 'bento-atlas atlas-panel-wrapper',
    });
    console.log('[ATLAS-WRAPPER] Constructor called');

    // Set initial loading content immediately
    this.setContent(`
      <div class="atlas-panel" id="atlas-panel" style="min-height: 300px;">
        <div class="atlas-header">
          <div class="atlas-title">
            <span class="atlas-logo">🌐</span>
            ATLAS
          </div>
          <div class="atlas-subtitle">Autonomous Threat & Landscape Analysis System</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 16px;">
          <div class="atlas-spinner"></div>
          <div style="color: #888; font-size: 13px;">Initializing ATLAS...</div>
        </div>
      </div>
    `);
  }

  async init(): Promise<void> {
    console.log('[ATLAS-WRAPPER] init() called, initialized:', this.initialized);
    if (this.initialized) return;
    this.initialized = true;

    try {
      console.log('[ATLAS-WRAPPER] Calling initAtlasPanel...');
      await initAtlasPanel();
      console.log('[ATLAS-WRAPPER] initAtlasPanel completed');

      // Render content
      const content = renderAtlasPanel();
      console.log('[ATLAS-WRAPPER] renderAtlasPanel returned content length:', content.length);
      this.setContent(content);
      console.log('[ATLAS-WRAPPER] setContent called');
    } catch (error) {
      console.error('[ATLAS-WRAPPER] init() failed:', error);
      this.setContent(`
        <div class="atlas-panel" style="padding: 20px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
          <div style="font-weight: bold; margin-bottom: 8px;">ATLAS Failed to Load</div>
          <div style="font-size: 12px; color: #888;">${error instanceof Error ? error.message : 'Unknown error'}</div>
        </div>
      `);
    }
  }

  onMount(): void {
    console.log('[ATLAS-WRAPPER] onMount() called');
    this.init().catch((err) => {
      console.error('[ATLAS-WRAPPER] onMount init failed:', err);
    });
  }
}
