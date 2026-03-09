/**
 * World Intel Panel - Consolidated Intelligence Dashboard
 *
 * Combines 4 intel panels into a single tabbed interface to reduce DOM nodes
 * and memory consumption. Only the active tab renders its content.
 *
 * Tabs:
 * - Space Weather (NOAA SWPC)
 * - Health Alerts (WHO, CDC)
 * - Elections (Global calendar)
 * - Shipping (Stress index)
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';

// Lazy-loaded tab content modules
type TabId = 'space' | 'health' | 'elections' | 'shipping';

interface TabConfig {
  id: TabId;
  icon: string;
  labelKey: string;
  loader: () => Promise<{ render: (container: HTMLElement) => void; cleanup?: () => void }>;
}

export class WorldIntelPanel extends Panel {
  private activeTab: TabId = 'space';
  private tabContent: HTMLElement | null = null;
  private loadedTabs = new Map<TabId, { render: (container: HTMLElement) => void; cleanup?: () => void }>();
  private currentCleanup: (() => void) | null = null;

  private readonly tabs: TabConfig[] = [
    {
      id: 'space',
      icon: '☀️',
      labelKey: 'components.spaceWeather.tabLabel',
      loader: () => import('@/services/space-weather').then(m => ({
        render: (container: HTMLElement) => this.renderSpaceWeather(container, m),
        cleanup: () => { /* cleanup if needed */ },
      })),
    },
    {
      id: 'health',
      icon: '🏥',
      labelKey: 'components.healthOutbreaks.tabLabel',
      loader: () => import('@/services/health-outbreaks').then(m => ({
        render: (container: HTMLElement) => this.renderHealthOutbreaks(container, m),
        cleanup: () => { /* cleanup if needed */ },
      })),
    },
    {
      id: 'elections',
      icon: '🗳️',
      labelKey: 'components.elections.tabLabel',
      loader: () => import('@/services/elections').then(m => ({
        render: (container: HTMLElement) => this.renderElections(container, m),
        cleanup: () => { /* cleanup if needed */ },
      })),
    },
    {
      id: 'shipping',
      icon: '🚢',
      labelKey: 'components.shipping.tabLabel',
      loader: () => import('@/services/shipping-stress').then(m => ({
        render: (container: HTMLElement) => this.renderShipping(container, m),
        cleanup: () => { /* cleanup if needed */ },
      })),
    },
  ];

  constructor() {
    super({
      id: 'world-intel',
      title: t('panels.worldIntel'),
      showCount: false,
      trackActivity: true,
      infoTooltip: t('components.worldIntel.infoTooltip'),
    });
    this.renderTabs();
  }

  private renderTabs(): void {
    const tabsHtml = this.tabs.map(tab => {
      const label = t(tab.labelKey) || tab.id;
      const active = tab.id === this.activeTab ? 'active' : '';
      return `<button class="wi-tab ${active}" data-tab="${tab.id}" title="${escapeHtml(String(label))}">
        <span class="wi-tab-icon">${tab.icon}</span>
        <span class="wi-tab-label">${escapeHtml(String(label))}</span>
      </button>`;
    }).join('');

    this.setContent(`
      <div class="world-intel-panel">
        <div class="wi-tabs">${tabsHtml}</div>
        <div class="wi-content" id="wiContent">
          <div class="wi-loading">${t('common.loading')}</div>
        </div>
      </div>
    `);

    // Attach tab click handlers
    const tabButtons = this.getElement().querySelectorAll('.wi-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab') as TabId;
        if (tabId && tabId !== this.activeTab) {
          this.switchTab(tabId);
        }
      });
    });

    // Store content container reference
    this.tabContent = this.getElement().querySelector('#wiContent');

    // Load initial tab
    void this.loadTab(this.activeTab);
  }

  private switchTab(tabId: TabId): void {
    // Update active state
    const tabs = this.getElement().querySelectorAll('.wi-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
    });

    // Cleanup previous tab
    if (this.currentCleanup) {
      this.currentCleanup();
      this.currentCleanup = null;
    }

    this.activeTab = tabId;
    void this.loadTab(tabId);
  }

  private async loadTab(tabId: TabId): Promise<void> {
    if (!this.tabContent) return;

    // Show loading state
    this.tabContent.innerHTML = `<div class="wi-loading">${t('common.loading')}</div>`;

    try {
      // Check if already loaded
      let tabModule = this.loadedTabs.get(tabId);

      if (!tabModule) {
        // Find and load the tab
        const tabConfig = this.tabs.find(t => t.id === tabId);
        if (!tabConfig) return;

        tabModule = await tabConfig.loader();
        this.loadedTabs.set(tabId, tabModule);
      }

      // Clear and render
      this.tabContent.innerHTML = '';
      tabModule.render(this.tabContent);
      this.currentCleanup = tabModule.cleanup ?? null;
    } catch (error) {
      console.error(`[WorldIntel] Failed to load tab ${tabId}:`, error);
      this.tabContent.innerHTML = `<div class="wi-error">${t('common.error')}</div>`;
    }
  }

  // ─── Tab Renderers ─────────────────────────────────────────────────────────

  private renderSpaceWeather(container: HTMLElement, m: typeof import('@/services/space-weather')): void {
    container.innerHTML = `<div class="wi-loading">${t('common.loading')}</div>`;

    void m.getSpaceWeather().then(data => {
      if (!data) {
        container.innerHTML = `<div class="wi-empty">${t('components.spaceWeather.noData')}</div>`;
        return;
      }

      const { currentKp, kpLevel, kpTrend, latestFlareClass, flareIntensity, alerts, kpRecent } = data;
      const kpColor = m.getKpSeverityColor(kpLevel);
      const kpIcon = m.getKpIcon(kpLevel);
      const trendArrow = kpTrend === 'rising' ? '↗️' : kpTrend === 'falling' ? '↘️' : '↔️';

      const flareSeverityClass = flareIntensity === 'extreme' ? 'flare-extreme'
        : flareIntensity === 'major' ? 'flare-major'
        : flareIntensity === 'moderate' ? 'flare-moderate'
        : 'flare-quiet';

      // Sparkline
      let sparklineHtml = '<div class="sw-sparkline sw-sparkline-empty">--</div>';
      if (kpRecent.length >= 2) {
        const maxKp = Math.max(...kpRecent.map(r => r.kp), 5);
        const width = 100, height = 30;
        const points = kpRecent.map((r, i) => {
          const x = (i / (kpRecent.length - 1)) * width;
          const y = height - (r.kp / maxKp) * height;
          return `${x},${y}`;
        }).join(' ');
        const maxKpInRecent = Math.max(...kpRecent.map(r => r.kp));
        const lineColor = maxKpInRecent >= 5 ? '#ff4500' : maxKpInRecent >= 4 ? '#ffd700' : '#00ff00';
        sparklineHtml = `<svg class="sw-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <polyline points="${points}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      }

      // Alerts (limit to 2)
      const alertsHtml = alerts.length > 0
        ? alerts.slice(0, 2).map(a => {
            const typeIcon = a.type === 'warning' ? '⚠️' : a.type === 'watch' ? '👀' : a.type === 'alert' ? '🚨' : '📝';
            const time = new Date(a.issueTime);
            const timeStr = time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return `<div class="sw-alert sw-alert-${a.severity}">
              <span class="sw-alert-icon">${typeIcon}</span>
              <span class="sw-alert-time">${timeStr}</span>
              <span class="sw-alert-message">${escapeHtml(a.message.slice(0, 60))}${a.message.length > 60 ? '...' : ''}</span>
            </div>`;
          }).join('')
        : `<div class="sw-no-alerts">${t('components.spaceWeather.noAlerts')}</div>`;

      container.innerHTML = `
        <div class="wi-space-weather">
          <div class="sw-metrics">
            <div class="sw-metric sw-kp">
              <div class="sw-metric-label">${t('components.spaceWeather.kpIndex')}</div>
              <div class="sw-metric-value" style="color: ${kpColor}">
                <span class="sw-icon">${kpIcon}</span>
                <span class="sw-kp-value">${m.formatKp(currentKp)}</span>
                <span class="sw-trend">${trendArrow}</span>
              </div>
              <div class="sw-metric-label sw-kp-level">${escapeHtml(kpLevel)}</div>
            </div>
            <div class="sw-metric sw-flare">
              <div class="sw-metric-label">${t('components.spaceWeather.solarFlare')}</div>
              <div class="sw-metric-value ${flareSeverityClass}">${latestFlareClass ? escapeHtml(latestFlareClass) : '--'}</div>
              <div class="sw-metric-label">${t(`components.spaceWeather.flareLevel.${flareIntensity}`)}</div>
            </div>
          </div>
          <div class="sw-sparkline-container">
            <div class="sw-sparkline-label">${t('components.spaceWeather.last24h')}</div>
            ${sparklineHtml}
          </div>
          <div class="sw-alerts">${alertsHtml}</div>
        </div>
      `;
    }).catch(() => {
      container.innerHTML = `<div class="wi-error">${t('common.error')}</div>`;
    });
  }

  private renderHealthOutbreaks(container: HTMLElement, m: typeof import('@/services/health-outbreaks')): void {
    container.innerHTML = `<div class="wi-loading">${t('common.loading')}</div>`;

    void m.getHealthOutbreaks().then(data => {
      if (!data || data.items.length === 0) {
        container.innerHTML = `<div class="wi-empty">${t('components.healthOutbreaks.noAlerts')}</div>`;
        return;
      }

      const { items, highConcernCount, byOrganization } = data;

      // Stats
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

      // Alerts (limit to 5 for memory)
      const sortedItems = [...items].sort((a, b) => {
        if (a.isHighConcern && !b.isHighConcern) return -1;
        if (!a.isHighConcern && b.isHighConcern) return 1;
        return 0;
      });

      const alertsHtml = sortedItems.slice(0, 5).map(item => {
        const severityIcon = m.getSeverityIcon(item.severity);
        const severityColor = m.getSeverityColor(item.severity);
        const date = new Date(item.publishedAt);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const pathogenBadges = item.pathogensDetected.slice(0, 2)
          .map(p => `<span class="ho-pathogen-badge">${escapeHtml(p)}</span>`)
          .join('');

        return `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" class="ho-alert ho-alert-${item.severity} ${item.isHighConcern ? 'ho-high-concern' : ''}">
          <div class="ho-alert-header">
            <span class="ho-alert-icon" style="color: ${severityColor}">${severityIcon}</span>
            <span class="ho-alert-org">${escapeHtml(item.organization)}</span>
            <span class="ho-alert-date">${dateStr}</span>
          </div>
          <div class="ho-alert-title">${escapeHtml(item.title.slice(0, 80))}${item.title.length > 80 ? '...' : ''}</div>
          ${pathogenBadges ? `<div class="ho-pathogens">${pathogenBadges}</div>` : ''}
        </a>`;
      }).join('');

      container.innerHTML = `
        <div class="wi-health-outbreaks">
          ${statsHtml}
          <div class="ho-sources">${sourcesHtml}</div>
          <div class="ho-alerts">${alertsHtml}</div>
        </div>
      `;
    }).catch(() => {
      container.innerHTML = `<div class="wi-error">${t('common.error')}</div>`;
    });
  }

  private renderElections(container: HTMLElement, m: typeof import('@/services/elections')): void {
    try {
      const data = m.fetchElectionCalendar();

      if (!data || data.elections.length === 0) {
        container.innerHTML = `<div class="wi-empty">${t('components.elections.noElections')}</div>`;
        return;
      }

      const { elections, upcomingCount, imminentCount, highestRisk } = data;

      // Stats
      const statsHtml = `
        <div class="el-stats">
          <div class="el-stat el-stat-imminent">
            <span class="el-stat-value">${imminentCount}</span>
            <span class="el-stat-label">${t('components.elections.imminent')}</span>
          </div>
          <div class="el-stat">
            <span class="el-stat-value">${upcomingCount}</span>
            <span class="el-stat-label">${t('components.elections.upcoming')}</span>
          </div>
        </div>
      `;

      // Highest risk highlight
      let highlightHtml = '';
      if (highestRisk && highestRisk.status !== 'past') {
        const riskColor = m.getRiskColor(highestRisk.riskScore);
        highlightHtml = `
          <div class="el-highlight" style="border-left-color: ${riskColor}">
            <div class="el-highlight-label">${t('components.elections.highestRisk')}</div>
            <div class="el-highlight-country">${m.getElectionIcon(highestRisk.electionType)} ${escapeHtml(highestRisk.country)}</div>
            <div class="el-highlight-details">
              <span class="el-highlight-type">${escapeHtml(highestRisk.electionType)}</span>
              <span class="el-highlight-date">${m.formatDaysUntil(highestRisk.daysUntil)}</span>
              <span class="el-highlight-score" style="color: ${riskColor}">${highestRisk.riskScore}</span>
            </div>
          </div>
        `;
      }

      // Election list (limit to 5)
      const upcomingElections = elections.filter(e => e.status !== 'past').slice(0, 5);
      const electionsHtml = upcomingElections.map(election => {
        const icon = m.getElectionIcon(election.electionType);
        const riskColor = m.getRiskColor(election.riskScore);
        const date = new Date(election.date);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        return `<div class="el-item el-status-${election.status}">
          <div class="el-item-icon">${icon}</div>
          <div class="el-item-content">
            <div class="el-item-country">${escapeHtml(election.country)}</div>
            <div class="el-item-type">${escapeHtml(election.electionType)}</div>
          </div>
          <div class="el-item-meta">
            <div class="el-item-date">${dateStr}</div>
            <div class="el-item-risk" style="color: ${riskColor}">${election.riskScore}</div>
          </div>
        </div>`;
      }).join('');

      container.innerHTML = `
        <div class="wi-elections">
          ${statsHtml}
          ${highlightHtml}
          <div class="el-list">${electionsHtml}</div>
        </div>
      `;
    } catch {
      container.innerHTML = `<div class="wi-error">${t('common.error')}</div>`;
    }
  }

  private renderShipping(container: HTMLElement, m: typeof import('@/services/shipping-stress')): void {
    container.innerHTML = `<div class="wi-loading">${t('common.loading')}</div>`;

    void m.getShippingStress().then(data => {
      if (!data) {
        container.innerHTML = `<div class="wi-empty">${t('components.shipping.noData')}</div>`;
        return;
      }

      const { quotes, stressScore, stressLevel, signals } = data;
      const stressColor = m.getStressColor(stressLevel);
      const stressIcon = m.getStressIcon(stressLevel);

      // Gauge
      const gaugeHtml = `
        <div class="ss-gauge">
          <div class="ss-gauge-header">
            <span class="ss-gauge-icon">${stressIcon}</span>
            <span class="ss-gauge-label">${t('components.shipping.stressIndex')}</span>
          </div>
          <div class="ss-gauge-value" style="color: ${stressColor}">${stressScore}</div>
          <div class="ss-gauge-bar">
            <div class="ss-gauge-fill" style="width: ${stressScore}%; background-color: ${stressColor}"></div>
          </div>
          <div class="ss-gauge-level" style="color: ${stressColor}">${escapeHtml(stressLevel.toUpperCase())}</div>
        </div>
      `;

      // Signals (limit to 2)
      const signalsHtml = signals.length > 0
        ? `<div class="ss-signals">${signals.slice(0, 2).map(s => `<span class="ss-signal">${escapeHtml(s)}</span>`).join('')}</div>`
        : '';

      // Quotes table (limit to 4)
      const quotesHtml = quotes.slice(0, 4).map(quote => {
        const changeStr = m.formatChangePct(quote.changePct);
        const changeClass = quote.changePct === null ? '' : quote.changePct >= 0 ? 'ss-positive' : 'ss-negative';
        const priceStr = quote.price !== null ? `$${quote.price.toFixed(2)}` : '--';
        const typeIcon = quote.type === 'container' ? '📦' : '🚢';

        return `<tr class="ss-quote-row">
          <td class="ss-quote-symbol">
            <span class="ss-quote-icon">${typeIcon}</span>
            <span class="ss-quote-ticker">${escapeHtml(quote.symbol)}</span>
          </td>
          <td class="ss-quote-price">${priceStr}</td>
          <td class="ss-quote-change ${changeClass}">${changeStr}</td>
        </tr>`;
      }).join('');

      container.innerHTML = `
        <div class="wi-shipping">
          ${gaugeHtml}
          ${signalsHtml}
          <div class="ss-quotes">
            <table class="ss-quotes-table">
              <thead><tr><th>${t('components.shipping.symbol')}</th><th>${t('components.shipping.price')}</th><th>${t('components.shipping.change')}</th></tr></thead>
              <tbody>${quotesHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    }).catch(() => {
      container.innerHTML = `<div class="wi-error">${t('common.error')}</div>`;
    });
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  public override destroy(): void {
    if (this.currentCleanup) {
      this.currentCleanup();
      this.currentCleanup = null;
    }
    this.loadedTabs.clear();
    super.destroy();
  }
}
