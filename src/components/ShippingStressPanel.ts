/**
 * Shipping Stress Panel
 *
 * Displays global shipping stress index based on dry bulk ETF volatility.
 * Higher volatility indicates supply chain disruptions.
 */

import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import {
  type ShippingStressData,
  type ShippingQuote,
  getStressColor,
  getStressIcon,
  formatChangePct,
} from '@/services/shipping-stress';
import { t } from '@/services/i18n';

export class ShippingStressPanel extends Panel {
  private data: ShippingStressData | null = null;

  constructor() {
    super({
      id: 'shipping-stress',
      title: t('panels.shippingStress'),
      showCount: false,
      trackActivity: true,
      infoTooltip: t('components.shipping.infoTooltip'),
    });
    this.showLoading(t('common.loading'));
  }

  public setData(data: ShippingStressData): void {
    this.data = data;
    this.renderContent();
  }

  public setError(message: string): void {
    this.setContent(`<div class="panel-empty">${escapeHtml(message)}</div>`);
  }

  private renderContent(): void {
    if (!this.data) {
      this.setContent(`<div class="panel-empty">${t('components.shipping.noData')}</div>`);
      return;
    }

    const { quotes, stressScore, stressLevel, signals } = this.data;

    const stressColor = getStressColor(stressLevel);
    const stressIcon = getStressIcon(stressLevel);

    // Stress gauge visualization
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

    // Signals alerts
    const signalsHtml = signals.length > 0
      ? `<div class="ss-signals">
          ${signals.map(s => `<span class="ss-signal">${escapeHtml(s)}</span>`).join('')}
        </div>`
      : '';

    // Quote table
    const quotesHtml = quotes.map(q => this.renderQuote(q)).join('');

    this.setContent(`
      <div class="shipping-stress-panel">
        ${gaugeHtml}
        ${signalsHtml}
        <div class="ss-quotes">
          <div class="ss-quotes-header">${t('components.shipping.dryBulkETFs')}</div>
          <table class="ss-quotes-table">
            <thead>
              <tr>
                <th>${t('components.shipping.symbol')}</th>
                <th>${t('components.shipping.price')}</th>
                <th>${t('components.shipping.change')}</th>
              </tr>
            </thead>
            <tbody>${quotesHtml}</tbody>
          </table>
        </div>
        <div class="ss-source">
          ${t('components.shipping.source')}: Yahoo Finance
        </div>
      </div>
    `);
  }

  private renderQuote(quote: ShippingQuote): string {
    const changeStr = formatChangePct(quote.changePct);
    const changeClass = quote.changePct === null ? ''
      : quote.changePct >= 0 ? 'ss-positive' : 'ss-negative';

    const priceStr = quote.price !== null ? `$${quote.price.toFixed(2)}` : '--';
    const typeIcon = quote.type === 'container' ? '\u{1F4E6}' : '\u{1F6A2}'; // 📦 or 🚢

    return `
      <tr class="ss-quote-row">
        <td class="ss-quote-symbol">
          <span class="ss-quote-icon">${typeIcon}</span>
          <span class="ss-quote-ticker">${escapeHtml(quote.symbol)}</span>
        </td>
        <td class="ss-quote-price">${priceStr}</td>
        <td class="ss-quote-change ${changeClass}">${changeStr}</td>
      </tr>
    `;
  }
}
