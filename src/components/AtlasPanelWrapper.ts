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
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Initialize the ATLAS panel
    await initAtlasPanel();

    // Render content
    this.setContent(renderAtlasPanel());
  }

  onMount(): void {
    // Re-initialize after mount
    this.init().catch(console.error);
  }
}
