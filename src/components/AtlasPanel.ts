/**
 * ATLAS Panel - Multi-Agent Intelligence Analysis UI
 * Displays real-time agent activity and threat correlations
 */

import { getApiBaseUrl } from '../services/runtime';

// ============================================================================
// Types
// ============================================================================

interface AgentFinding {
  category: string;
  severity: number;
  summary: string;
  details: string;
  timestamp: string;
  source: string;
}

interface AgentReport {
  agentName: string;
  findings: AgentFinding[];
  overallSeverity: number;
  toolsCalled: string[];
  rawAnalysis: string;
  executionTimeMs: number;
}

interface CorrelatedPattern {
  type: string;
  description: string;
  confidence: number;
  involvedAgents: string[];
}

interface AtlasAnalysis {
  region: string;
  regionName: string;
  timestamp: string;
  agentReports: AgentReport[];
  correlations: {
    correlatedPatterns: CorrelatedPattern[];
    signalStrength: number;
    cascadeRisk: string;
  };
  threatScore: number;
  summary: string;
  keyFindings: string[];
  recommendedActions: string[];
  totalExecutionTimeMs: number;
}

interface AtlasRegion {
  id: string;
  name: string;
  countries: string[];
}

// ============================================================================
// State
// ============================================================================

let currentAnalysis: AtlasAnalysis | null = null;
let isAnalyzing = false;
let activeAgents: Set<string> = new Set();
let regions: AtlasRegion[] = [];
let selectedRegion = 'middle-east';
let atlasEnabled = false;

// ============================================================================
// API Calls
// ============================================================================

async function fetchAtlasStatus(): Promise<{ enabled: boolean; agents: string[]; provider: string }> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/atlas/status`);
    if (!response.ok) throw new Error('Failed to fetch ATLAS status');
    return response.json();
  } catch (error) {
    console.error('ATLAS status error:', error);
    return { enabled: true, agents: ['GeoInt', 'FinInt', 'ThreatInt'], provider: 'Demo Mode' };
  }
}

async function fetchAtlasRegions(): Promise<AtlasRegion[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/atlas/regions`);
    if (!response.ok) throw new Error('Failed to fetch regions');
    const data = await response.json();
    return data.regions || [];
  } catch (error) {
    console.error('ATLAS regions error:', error);
    return [
      { id: 'middle-east', name: 'Middle East', countries: ['Israel', 'Iran', 'Iraq', 'Syria'] },
      { id: 'asia-pacific', name: 'Asia Pacific', countries: ['China', 'Japan', 'Taiwan'] },
      { id: 'europe', name: 'Europe', countries: ['Ukraine', 'Russia', 'Poland'] },
    ];
  }
}

async function runAtlasAnalysis(region: string): Promise<AtlasAnalysis> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/atlas/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ region }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Analysis failed');
  }

  return response.json();
}

// ============================================================================
// Rendering
// ============================================================================

function getSeverityColor(severity: number): string {
  if (severity >= 8) return '#ef4444';
  if (severity >= 6) return '#f97316';
  if (severity >= 4) return '#eab308';
  return '#22c55e';
}

function getThreatScoreColor(score: number): string {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f97316';
  return '#22c55e';
}

function getCascadeRiskColor(risk: string): string {
  if (risk === 'high') return '#ef4444';
  if (risk === 'medium') return '#f97316';
  return '#22c55e';
}

function renderAgentStatus(): string {
  const agents = ['GeoInt', 'FinInt', 'ThreatInt'];
  return agents.map(agent => {
    const isActive = activeAgents.has(agent);
    const report = currentAnalysis?.agentReports.find(r => r.agentName === agent);

    let status = 'idle';
    let color = '#666';
    let icon = '&#9679;'; // Circle

    if (isActive) {
      status = 'analyzing';
      color = '#3b82f6';
      icon = '&#9881;'; // Gear
    } else if (report) {
      status = `${report.findings.length} findings`;
      color = getSeverityColor(report.overallSeverity);
      icon = '&#10003;'; // Checkmark
    }

    return `
      <div class="atlas-agent" data-agent="${agent}">
        <span class="atlas-agent-icon" style="color: ${color}">${icon}</span>
        <span class="atlas-agent-name">${agent}</span>
        <span class="atlas-agent-status" style="color: ${color}">${status}</span>
      </div>
    `;
  }).join('');
}

function renderFindings(report: AgentReport): string {
  return report.findings.map(finding => `
    <div class="atlas-finding">
      <div class="atlas-finding-header">
        <span class="atlas-finding-category">${finding.category.replace(/_/g, ' ')}</span>
        <span class="atlas-finding-severity" style="background: ${getSeverityColor(finding.severity)}">${finding.severity}/10</span>
      </div>
      <div class="atlas-finding-summary">${finding.summary}</div>
      <div class="atlas-finding-meta">
        <span>${finding.source}</span>
        <span>${new Date(finding.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  `).join('');
}

function renderCorrelations(): string {
  if (!currentAnalysis || currentAnalysis.correlations.correlatedPatterns.length === 0) {
    return '<div class="atlas-no-correlations">No cross-domain correlations detected</div>';
  }

  return currentAnalysis.correlations.correlatedPatterns.map(pattern => `
    <div class="atlas-correlation">
      <div class="atlas-correlation-header">
        <span class="atlas-correlation-type">${pattern.type}</span>
        <span class="atlas-correlation-confidence">${pattern.confidence}%</span>
      </div>
      <div class="atlas-correlation-description">${pattern.description}</div>
      <div class="atlas-correlation-agents">
        ${pattern.involvedAgents.map(a => `<span class="atlas-correlation-agent">${a}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderAnalysisResults(): string {
  if (!currentAnalysis) {
    return `
      <div class="atlas-empty">
        <div class="atlas-empty-icon">&#127758;</div>
        <div class="atlas-empty-text">Select a region and click "Analyze" to run multi-agent threat assessment</div>
      </div>
    `;
  }

  const scoreColor = getThreatScoreColor(currentAnalysis.threatScore);
  const riskColor = getCascadeRiskColor(currentAnalysis.correlations.cascadeRisk);

  return `
    <div class="atlas-results">
      <div class="atlas-score-section">
        <div class="atlas-score" style="border-color: ${scoreColor}">
          <div class="atlas-score-value" style="color: ${scoreColor}">${currentAnalysis.threatScore}</div>
          <div class="atlas-score-label">Threat Score</div>
        </div>
        <div class="atlas-cascade-risk" style="border-color: ${riskColor}">
          <div class="atlas-cascade-value" style="color: ${riskColor}">${currentAnalysis.correlations.cascadeRisk.toUpperCase()}</div>
          <div class="atlas-cascade-label">Cascade Risk</div>
        </div>
      </div>

      <div class="atlas-summary">${currentAnalysis.summary}</div>

      <div class="atlas-section">
        <div class="atlas-section-title">Key Findings</div>
        <div class="atlas-key-findings">
          ${currentAnalysis.keyFindings.map(f => `<div class="atlas-key-finding">${f}</div>`).join('')}
        </div>
      </div>

      <div class="atlas-section">
        <div class="atlas-section-title">Cross-Domain Correlations</div>
        ${renderCorrelations()}
      </div>

      <div class="atlas-section">
        <div class="atlas-section-title">Agent Reports</div>
        <div class="atlas-agent-reports">
          ${currentAnalysis.agentReports.map(report => `
            <details class="atlas-report">
              <summary class="atlas-report-header">
                <span class="atlas-report-name">${report.agentName}</span>
                <span class="atlas-report-severity" style="color: ${getSeverityColor(report.overallSeverity)}">
                  Severity: ${report.overallSeverity.toFixed(1)}
                </span>
              </summary>
              <div class="atlas-report-content">
                ${renderFindings(report)}
              </div>
            </details>
          `).join('')}
        </div>
      </div>

      <div class="atlas-section">
        <div class="atlas-section-title">Recommended Actions</div>
        <ul class="atlas-actions">
          ${currentAnalysis.recommendedActions.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>

      <div class="atlas-meta">
        Analysis completed in ${currentAnalysis.totalExecutionTimeMs.toFixed(0)}ms
      </div>
    </div>
  `;
}

export function renderAtlasPanel(): string {
  const regionOptions = regions.map(r =>
    `<option value="${r.id}" ${r.id === selectedRegion ? 'selected' : ''}>${r.name}</option>`
  ).join('');

  return `
    <div class="atlas-panel" id="atlas-panel">
      <div class="atlas-header">
        <div class="atlas-title">
          <span class="atlas-logo">&#127758;</span>
          ATLAS
        </div>
        <div class="atlas-subtitle">Autonomous Threat & Landscape Analysis System</div>
      </div>

      <div class="atlas-controls">
        <select id="atlas-region-select" class="atlas-select" ${isAnalyzing ? 'disabled' : ''}>
          ${regionOptions}
        </select>
        <button id="atlas-analyze-btn" class="atlas-btn" ${isAnalyzing ? 'disabled' : ''}>
          ${isAnalyzing ? '<span class="atlas-spinner"></span> Analyzing...' : 'Analyze Region'}
        </button>
      </div>

      <div class="atlas-agents">
        <div class="atlas-agents-title">Agent Status</div>
        <div class="atlas-agents-grid">
          ${renderAgentStatus()}
        </div>
      </div>

      <div class="atlas-content">
        ${renderAnalysisResults()}
      </div>
    </div>
  `;
}

// ============================================================================
// Initialization & Event Handlers
// ============================================================================

async function handleAnalyze() {
  if (isAnalyzing) return;

  isAnalyzing = true;
  activeAgents.clear();
  currentAnalysis = null;
  updatePanel();

  // Simulate agent activity
  const agents = ['GeoInt', 'FinInt', 'ThreatInt'];
  for (const agent of agents) {
    activeAgents.add(agent);
    updatePanel();
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
  }

  try {
    currentAnalysis = await runAtlasAnalysis(selectedRegion);
  } catch (error) {
    console.error('ATLAS analysis error:', error);
  } finally {
    isAnalyzing = false;
    activeAgents.clear();
    updatePanel();
  }
}

function updatePanel() {
  const panel = document.getElementById('atlas-panel');
  if (panel) {
    panel.outerHTML = renderAtlasPanel();
    attachEventListeners();
  }
}

function attachEventListeners() {
  const analyzeBtn = document.getElementById('atlas-analyze-btn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', handleAnalyze);
  }

  const regionSelect = document.getElementById('atlas-region-select') as HTMLSelectElement;
  if (regionSelect) {
    regionSelect.addEventListener('change', (e) => {
      selectedRegion = (e.target as HTMLSelectElement).value;
    });
  }
}

export async function initAtlasPanel() {
  // Fetch initial data
  const [status, regionData] = await Promise.all([
    fetchAtlasStatus(),
    fetchAtlasRegions(),
  ]);

  atlasEnabled = status.enabled;
  regions = regionData;

  // Attach initial event listeners
  attachEventListeners();

  console.log('ATLAS Panel initialized:', { enabled: atlasEnabled, regions: regions.length });
}

// Export for external use
export { currentAnalysis, isAnalyzing, selectedRegion };
