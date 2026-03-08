/**
 * Space Weather Panel
 *
 * Displays real-time solar activity from NOAA SWPC:
 * - Current Kp index (geomagnetic storm level)
 * - Solar flare activity (X-ray flux)
 * - Space weather alerts
 * - Kp trend chart
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import {
  type SpaceWeatherData,
  type SpaceWeatherAlert,
  getKpSeverityColor,
  getKpIcon,
  formatKp,
} from '@/services/space-weather';
import { t } from '@/services/i18n';

export class SpaceWeatherPanel extends Panel {
  private data: SpaceWeatherData | null = null;

  constructor() {
    super({
      id: 'space-weather',
      title: t('panels.spaceWeather'),
      showCount: false,
      trackActivity: true,
      infoTooltip: t('components.spaceWeather.infoTooltip'),
    });
    this.showLoading(t('common.loading'));
  }

  public setData(data: SpaceWeatherData): void {
    this.data = data;
    this.renderContent();
  }

  public setError(message: string): void {
    this.setContent(`<div class="panel-empty">${escapeHtml(message)}</div>`);
  }

  private renderContent(): void {
    if (!this.data) {
      this.setContent(`<div class="panel-empty">${t('components.spaceWeather.noData')}</div>`);
      return;
    }

    const { currentKp, kpLevel, kpTrend, latestFlareClass, flareIntensity, alerts, kpRecent } = this.data;

    // Kp gauge color
    const kpColor = getKpSeverityColor(kpLevel);
    const kpIcon = getKpIcon(kpLevel);

    // Trend arrow
    const trendArrow = kpTrend === 'rising' ? '\u{2197}\u{FE0F}' : kpTrend === 'falling' ? '\u{2198}\u{FE0F}' : '\u{2194}\u{FE0F}';

    // Flare class styling
    const flareSeverityClass = flareIntensity === 'extreme' ? 'flare-extreme'
      : flareIntensity === 'major' ? 'flare-major'
      : flareIntensity === 'moderate' ? 'flare-moderate'
      : 'flare-quiet';

    // Render Kp sparkline (mini chart)
    const sparklineHtml = this.renderSparkline(kpRecent);

    // Render alerts
    const alertsHtml = alerts.length > 0
      ? alerts.slice(0, 3).map(a => this.renderAlert(a)).join('')
      : `<div class="sw-no-alerts">${t('components.spaceWeather.noAlerts')}</div>`;

    this.setContent(`
      <div class="space-weather-panel">
        <div class="sw-metrics">
          <div class="sw-metric sw-kp">
            <div class="sw-metric-label">${t('components.spaceWeather.kpIndex')}</div>
            <div class="sw-metric-value" style="color: ${kpColor}">
              <span class="sw-icon">${kpIcon}</span>
              <span class="sw-kp-value">${formatKp(currentKp)}</span>
              <span class="sw-trend">${trendArrow}</span>
            </div>
            <div class="sw-metric-label sw-kp-level">${escapeHtml(kpLevel)}</div>
          </div>
          <div class="sw-metric sw-flare">
            <div class="sw-metric-label">${t('components.spaceWeather.solarFlare')}</div>
            <div class="sw-metric-value ${flareSeverityClass}">
              ${latestFlareClass ? escapeHtml(latestFlareClass) : '--'}
            </div>
            <div class="sw-metric-label">${t(`components.spaceWeather.flareLevel.${flareIntensity}`)}</div>
          </div>
        </div>
        <div class="sw-sparkline-container">
          <div class="sw-sparkline-label">${t('components.spaceWeather.last24h')}</div>
          ${sparklineHtml}
        </div>
        <div class="sw-alerts">
          <div class="sw-alerts-header">${t('components.spaceWeather.alerts')}</div>
          ${alertsHtml}
        </div>
        <div class="sw-source">
          ${t('components.spaceWeather.source')}: <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener">NOAA SWPC</a>
        </div>
      </div>
    `);
  }

  private renderSparkline(kpRecent: { time: string; kp: number }[]): string {
    if (kpRecent.length < 2) {
      return '<div class="sw-sparkline sw-sparkline-empty">--</div>';
    }

    const maxKp = Math.max(...kpRecent.map(r => r.kp), 5);
    const width = 100;
    const height = 30;
    const points = kpRecent.map((r, i) => {
      const x = (i / (kpRecent.length - 1)) * width;
      const y = height - (r.kp / maxKp) * height;
      return `${x},${y}`;
    }).join(' ');

    // Color based on max Kp
    const maxKpInRecent = Math.max(...kpRecent.map(r => r.kp));
    const lineColor = maxKpInRecent >= 5 ? '#ff4500' : maxKpInRecent >= 4 ? '#ffd700' : '#00ff00';

    return `
      <svg class="sw-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline
          points="${points}"
          fill="none"
          stroke="${lineColor}"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private renderAlert(alert: SpaceWeatherAlert): string {
    const severityClass = `sw-alert-${alert.severity}`;
    const typeIcon = alert.type === 'warning' ? '\u{26A0}\u{FE0F}'
      : alert.type === 'watch' ? '\u{1F440}'
      : alert.type === 'alert' ? '\u{1F6A8}'
      : '\u{1F4DD}';

    // Format time
    const time = new Date(alert.issueTime);
    const timeStr = time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="sw-alert ${severityClass}">
        <span class="sw-alert-icon">${typeIcon}</span>
        <span class="sw-alert-time">${timeStr}</span>
        <span class="sw-alert-message">${escapeHtml(alert.message.slice(0, 80))}${alert.message.length > 80 ? '...' : ''}</span>
      </div>
    `;
  }
}
