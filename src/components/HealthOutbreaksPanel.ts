/**
 * Health Outbreaks Panel
 *
 * Displays disease outbreak alerts from WHO, CDC, and other health organizations.
 * Highlights high-concern pathogens (Ebola, H5N1, Mpox, etc.)
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import {
  type HealthOutbreaksData,
  type HealthOutbreak,
  getSeverityColor,
  getSeverityIcon,
} from '@/services/health-outbreaks';
import { t } from '@/services/i18n';

export class HealthOutbreaksPanel extends Panel {
  private data: HealthOutbreaksData | null = null;

  constructor() {
    super({
      id: 'health-outbreaks',
      title: t('panels.healthOutbreaks'),
      showCount: true,
      trackActivity: true,
      infoTooltip: t('components.healthOutbreaks.infoTooltip'),
    });
    this.showLoading(t('common.loading'));
  }

  public setData(data: HealthOutbreaksData): void {
    this.data = data;
    this.setCount(data.highConcernCount);
    this.renderContent();
  }

  public setError(message: string): void {
    this.setContent(`<div class="panel-empty">${escapeHtml(message)}</div>`);
  }

  private renderContent(): void {
    if (!this.data || this.data.items.length === 0) {
      this.setContent(`<div class="panel-empty">${t('components.healthOutbreaks.noAlerts')}</div>`);
      return;
    }

    const { items, highConcernCount, byOrganization } = this.data;

    // Summary stats
    const statsHtml = `
      <div class="ho-stats">
        <div class="ho-stat">
          <span class="ho-stat-value">${highConcernCount}</span>
          <span class="ho-stat-label">${t('components.healthOutbreaks.highConcern')}</span>
        </div>
        <div class="ho-stat">
          <span class="ho-stat-value">${items.length}</span>
          <span class="ho-stat-label">${t('components.healthOutbreaks.total')}</span>
        </div>
      </div>
    `;

    // Source badges
    const sourcesHtml = Object.entries(byOrganization)
      .map(([org, count]) => `<span class="ho-source-badge ho-org-${org.toLowerCase()}">${org}: ${count}</span>`)
      .join('');

    // Alert items - show high concern first
    const sortedItems = [...items].sort((a, b) => {
      if (a.isHighConcern && !b.isHighConcern) return -1;
      if (!a.isHighConcern && b.isHighConcern) return 1;
      return 0;
    });

    const alertsHtml = sortedItems.slice(0, 10).map(item => this.renderAlert(item)).join('');

    this.setContent(`
      <div class="health-outbreaks-panel">
        ${statsHtml}
        <div class="ho-sources">${sourcesHtml}</div>
        <div class="ho-alerts">${alertsHtml}</div>
        <div class="ho-footer">
          ${t('components.healthOutbreaks.sources')}: WHO, CDC, Outbreak News
        </div>
      </div>
    `);
  }

  private renderAlert(item: HealthOutbreak): string {
    const severityIcon = getSeverityIcon(item.severity);
    const severityColor = getSeverityColor(item.severity);
    const severityClass = `ho-alert-${item.severity}`;
    const highConcernClass = item.isHighConcern ? 'ho-high-concern' : '';

    // Format date
    const date = new Date(item.publishedAt);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    // Pathogen badges
    const pathogenBadges = item.pathogensDetected.slice(0, 3)
      .map(p => `<span class="ho-pathogen-badge">${escapeHtml(p)}</span>`)
      .join('');

    return `
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" class="ho-alert ${severityClass} ${highConcernClass}">
        <div class="ho-alert-header">
          <span class="ho-alert-icon" style="color: ${severityColor}">${severityIcon}</span>
          <span class="ho-alert-org">${escapeHtml(item.organization)}</span>
          <span class="ho-alert-date">${dateStr}</span>
        </div>
        <div class="ho-alert-title">${escapeHtml(item.title)}</div>
        ${pathogenBadges ? `<div class="ho-pathogens">${pathogenBadges}</div>` : ''}
      </a>
    `;
  }
}
