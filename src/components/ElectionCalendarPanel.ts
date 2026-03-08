/**
 * Election Calendar Panel
 *
 * Displays upcoming global elections with risk scoring.
 * Higher risk scores indicate elections closer in time with higher instability impact.
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import {
  fetchElectionCalendar,
  type ElectionCalendarData,
  type Election,
  getRiskColor,
  getElectionIcon,
  formatDaysUntil,
} from '@/services/elections';
import { t } from '@/services/i18n';

export class ElectionCalendarPanel extends Panel {
  private data: ElectionCalendarData | null = null;

  constructor() {
    super({
      id: 'election-calendar',
      title: t('panels.electionCalendar'),
      showCount: true,
      trackActivity: true,
      infoTooltip: t('components.elections.infoTooltip'),
    });
    this.loadData();
  }

  public loadData(): void {
    this.showLoading(t('common.loading'));
    // Election data is local, no async needed
    try {
      this.data = fetchElectionCalendar();
      this.setCount(this.data.imminentCount);
      this.renderContent();
    } catch (e) {
      this.setContent(`<div class="panel-empty">${t('components.elections.error')}</div>`);
    }
  }

  public refresh(): void {
    this.loadData();
  }

  private renderContent(): void {
    if (!this.data || this.data.elections.length === 0) {
      this.setContent(`<div class="panel-empty">${t('components.elections.noElections')}</div>`);
      return;
    }

    const { elections, upcomingCount, imminentCount, highestRisk } = this.data;

    // Stats summary
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
      const riskColor = getRiskColor(highestRisk.riskScore);
      highlightHtml = `
        <div class="el-highlight" style="border-left-color: ${riskColor}">
          <div class="el-highlight-label">${t('components.elections.highestRisk')}</div>
          <div class="el-highlight-country">${getElectionIcon(highestRisk.electionType)} ${escapeHtml(highestRisk.country)}</div>
          <div class="el-highlight-details">
            <span class="el-highlight-type">${escapeHtml(highestRisk.electionType)}</span>
            <span class="el-highlight-date">${formatDaysUntil(highestRisk.daysUntil)}</span>
            <span class="el-highlight-score" style="color: ${riskColor}">${highestRisk.riskScore}</span>
          </div>
        </div>
      `;
    }

    // Election list - filter to upcoming/imminent only, limit to 8
    const upcomingElections = elections
      .filter(e => e.status !== 'past')
      .slice(0, 8);

    const electionsHtml = upcomingElections.map(e => this.renderElection(e)).join('');

    this.setContent(`
      <div class="election-calendar-panel">
        ${statsHtml}
        ${highlightHtml}
        <div class="el-list">
          <div class="el-list-header">${t('components.elections.upcomingElections')}</div>
          ${electionsHtml}
        </div>
      </div>
    `);
  }

  private renderElection(election: Election): string {
    const icon = getElectionIcon(election.electionType);
    const riskColor = getRiskColor(election.riskScore);
    const statusClass = `el-status-${election.status}`;
    const impactClass = `el-impact-${election.instabilityImpact}`;

    // Format date
    const date = new Date(election.date);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return `
      <div class="el-item ${statusClass} ${impactClass}">
        <div class="el-item-icon">${icon}</div>
        <div class="el-item-content">
          <div class="el-item-country">${escapeHtml(election.country)}</div>
          <div class="el-item-type">${escapeHtml(election.electionType)}</div>
          <div class="el-item-date">${dateStr}</div>
        </div>
        <div class="el-item-meta">
          <div class="el-item-countdown">${formatDaysUntil(election.daysUntil)}</div>
          <div class="el-item-risk" style="color: ${riskColor}">
            <span class="el-risk-label">${t('components.elections.risk')}</span>
            <span class="el-risk-value">${election.riskScore}</span>
          </div>
        </div>
      </div>
    `;
  }
}
