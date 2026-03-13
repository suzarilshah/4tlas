/**
 * ATLAS Multi-Agent Orchestrator
 * Coordinates GeoInt, FinInt, and ThreatInt agents for comprehensive analysis
 */

import {
  AzureFoundryClient,
  type ToolDefinition,
} from './azure-foundry';
import {
  ATLAS_REGIONS,
  GEOINT_TOOLS,
  FININT_TOOLS,
  THREATINT_TOOLS,
  AGENT_PROMPTS,
  type AtlasRegion,
} from './agent-functions';
import { correlateFindings, type CorrelationResult } from './correlator';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentFinding {
  category: string;
  severity: number; // 1-10
  summary: string;
  details: string;
  timestamp: string;
  source: string;
}

export interface AgentReport {
  agentName: 'GeoInt' | 'FinInt' | 'ThreatInt';
  region: AtlasRegion;
  findings: AgentFinding[];
  overallSeverity: number;
  toolsCalled: string[];
  rawAnalysis: string;
  executionTimeMs: number;
}

export interface AtlasAnalysis {
  region: AtlasRegion;
  regionName: string;
  timestamp: string;
  agentReports: AgentReport[];
  correlations: CorrelationResult;
  threatScore: number;
  summary: string;
  keyFindings: string[];
  recommendedActions: string[];
  totalExecutionTimeMs: number;
}

export interface AtlasEvent {
  type: 'agent_start' | 'agent_complete' | 'tool_call' | 'correlation' | 'complete';
  agent?: string;
  tool?: string;
  data?: unknown;
  timestamp: number;
}

// ============================================================================
// MOCK DATA PROVIDERS (Replace with real World Monitor API calls)
// ============================================================================

/**
 * These functions simulate World Monitor API responses.
 * In production, replace with actual fetch calls to the Worker endpoints.
 */

async function mockGetConflictEvents(region: AtlasRegion, _daysBack = 7): Promise<AgentFinding[]> {
  // regionData can be used for more detailed mock data in future
  void ATLAS_REGIONS[region];
  const conflicts: AgentFinding[] = [];

  // Simulate region-specific conflict data
  if (region === 'middle-east') {
    conflicts.push(
      {
        category: 'armed_conflict',
        severity: 8,
        summary: 'Escalating border tensions in northern region',
        details: '3 incidents reported along disputed border, including artillery exchanges',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        source: 'ACLED',
      },
      {
        category: 'protest',
        severity: 6,
        summary: 'Large-scale protests in Beirut over economic conditions',
        details: 'Estimated 15,000 protesters, some clashes with security forces',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        source: 'ACLED',
      }
    );
  } else if (region === 'europe') {
    conflicts.push({
      category: 'armed_conflict',
      severity: 9,
      summary: 'Continued military operations in eastern Ukraine',
      details: 'Heavy fighting reported near multiple frontline positions',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      source: 'UCDP',
    });
  } else if (region === 'asia-pacific') {
    conflicts.push({
      category: 'military_posturing',
      severity: 7,
      summary: 'Increased naval activity in South China Sea',
      details: 'Multiple carrier groups conducting exercises in disputed waters',
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      source: 'OSINT',
    });
  }

  return conflicts;
}

async function mockGetMarketIndicators(region: AtlasRegion): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  if (region === 'middle-east') {
    findings.push(
      {
        category: 'commodity',
        severity: 7,
        summary: 'Brent crude up 8% this week',
        details: 'Oil prices surging on supply concerns and regional tensions',
        timestamp: new Date().toISOString(),
        source: 'Market Data',
      },
      {
        category: 'currency',
        severity: 6,
        summary: 'Lebanese Pound weakness continues',
        details: 'LBP down 3% against USD, parallel market rate widening',
        timestamp: new Date().toISOString(),
        source: 'Forex',
      }
    );
  } else if (region === 'asia-pacific') {
    findings.push({
      category: 'equity',
      severity: 5,
      summary: 'Taiwan semiconductor stocks volatile',
      details: 'TSMC down 4% on geopolitical concerns',
      timestamp: new Date().toISOString(),
      source: 'Market Data',
    });
  }

  return findings;
}

async function mockGetCyberThreats(region: AtlasRegion): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  if (region === 'middle-east') {
    findings.push({
      category: 'apt_activity',
      severity: 7,
      summary: 'Increased scanning against energy infrastructure',
      details: 'APT33-attributed scanning detected targeting SCADA systems',
      timestamp: new Date(Date.now() - 43200000).toISOString(),
      source: 'Threat Intel',
    });
  } else if (region === 'europe') {
    findings.push({
      category: 'infrastructure',
      severity: 6,
      summary: 'DDoS attacks on government websites',
      details: 'Multiple EU member state government portals targeted',
      timestamp: new Date(Date.now() - 21600000).toISOString(),
      source: 'CERT',
    });
  }

  return findings;
}

async function mockGetNaturalDisasters(region: AtlasRegion): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  if (region === 'middle-east') {
    findings.push({
      category: 'earthquake',
      severity: 4,
      summary: '4.2 magnitude earthquake near Turkish border',
      details: 'Minor earthquake, no significant damage reported',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      source: 'USGS',
    });
  } else if (region === 'asia-pacific') {
    findings.push({
      category: 'typhoon',
      severity: 6,
      summary: 'Tropical storm forming in Western Pacific',
      details: 'Potential to strengthen, Philippines on alert',
      timestamp: new Date().toISOString(),
      source: 'NOAA',
    });
  }

  return findings;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

/**
 * Executes tool calls for the agents
 */
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  _baseUrl?: string
): Promise<string> {
  const region = (args.region as AtlasRegion) || 'middle-east';

  // In a real implementation, these would call the World Monitor APIs
  // For now, we use mock data
  try {
    switch (toolName) {
      case 'get_conflict_events':
      case 'get_protest_activity':
      case 'get_breaking_news': {
        const events = await mockGetConflictEvents(region);
        return JSON.stringify({
          success: true,
          data: events,
          count: events.length,
        });
      }

      case 'get_market_indicators':
      case 'get_commodity_prices':
      case 'get_economic_stress_indicators': {
        const market = await mockGetMarketIndicators(region);
        return JSON.stringify({
          success: true,
          data: market,
          count: market.length,
        });
      }

      case 'get_cyber_threats':
      case 'get_infrastructure_status':
      case 'get_military_activity': {
        const threats = await mockGetCyberThreats(region);
        return JSON.stringify({
          success: true,
          data: threats,
          count: threats.length,
        });
      }

      case 'get_natural_disasters': {
        const disasters = await mockGetNaturalDisasters(region);
        return JSON.stringify({
          success: true,
          data: disasters,
          count: disasters.length,
        });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    });
  }
}

// ============================================================================
// AGENT RUNNERS
// ============================================================================

async function runAgent(
  client: AzureFoundryClient,
  agentName: 'GeoInt' | 'FinInt' | 'ThreatInt',
  systemPrompt: string,
  tools: ToolDefinition[],
  region: AtlasRegion,
  query: string,
  onEvent?: (event: AtlasEvent) => void
): Promise<AgentReport> {
  const startTime = Date.now();

  onEvent?.({
    type: 'agent_start',
    agent: agentName,
    timestamp: startTime,
  });

  const regionInfo = ATLAS_REGIONS[region];
  const fullQuery = `Analyze ${regionInfo.name} (${region}) for: ${query}. Focus on the last 7 days.`;

  const result = await client.executeWithTools(
    systemPrompt,
    fullQuery,
    tools,
    async (name, args) => {
      onEvent?.({
        type: 'tool_call',
        agent: agentName,
        tool: name,
        data: args,
        timestamp: Date.now(),
      });
      return executeToolCall(name, args);
    }
  );

  // Parse findings from tool results
  const findings: AgentFinding[] = [];
  for (const toolCall of result.toolCalls) {
    try {
      const parsed = JSON.parse(toolCall.result);
      if (parsed.success && Array.isArray(parsed.data)) {
        findings.push(...parsed.data);
      }
    } catch {
      // Skip unparseable results
    }
  }

  const report: AgentReport = {
    agentName,
    region,
    findings,
    overallSeverity: findings.length > 0
      ? Math.round(findings.reduce((sum, f) => sum + f.severity, 0) / findings.length)
      : 0,
    toolsCalled: result.toolCalls.map(tc => tc.name),
    rawAnalysis: result.finalResponse,
    executionTimeMs: Date.now() - startTime,
  };

  onEvent?.({
    type: 'agent_complete',
    agent: agentName,
    data: {
      findingsCount: findings.length,
      severity: report.overallSeverity,
    },
    timestamp: Date.now(),
  });

  return report;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export async function analyzeRegion(
  client: AzureFoundryClient,
  region: AtlasRegion,
  onEvent?: (event: AtlasEvent) => void
): Promise<AtlasAnalysis> {
  const startTime = Date.now();
  const regionInfo = ATLAS_REGIONS[region];

  // Run all three agents in parallel
  const [geoIntReport, finIntReport, threatIntReport] = await Promise.all([
    runAgent(
      client,
      'GeoInt',
      AGENT_PROMPTS.geoint,
      GEOINT_TOOLS,
      region,
      'current conflicts, protests, and political developments',
      onEvent
    ),
    runAgent(
      client,
      'FinInt',
      AGENT_PROMPTS.finint,
      FININT_TOOLS,
      region,
      'market conditions, commodity prices, and economic stress indicators',
      onEvent
    ),
    runAgent(
      client,
      'ThreatInt',
      AGENT_PROMPTS.threatint,
      THREATINT_TOOLS,
      region,
      'cyber threats, natural disasters, infrastructure status, and military activity',
      onEvent
    ),
  ]);

  const agentReports = [geoIntReport, finIntReport, threatIntReport];

  // Correlate findings across agents
  onEvent?.({
    type: 'correlation',
    data: { reportsCount: agentReports.length },
    timestamp: Date.now(),
  });

  const correlations = correlateFindings(agentReports);

  // Calculate overall threat score (0-100)
  const avgSeverity = agentReports.reduce((sum, r) => sum + r.overallSeverity, 0) / 3;
  const correlationBoost = correlations.correlatedPatterns.length * 5;
  const threatScore = Math.min(100, Math.round(avgSeverity * 10 + correlationBoost));

  // Generate key findings
  const keyFindings: string[] = [];
  for (const report of agentReports) {
    const topFinding = report.findings.sort((a, b) => b.severity - a.severity)[0];
    if (topFinding) {
      keyFindings.push(`[${report.agentName}] ${topFinding.summary}`);
    }
  }

  // Add correlation findings
  for (const pattern of correlations.correlatedPatterns.slice(0, 2)) {
    keyFindings.push(`[Correlation] ${pattern.description}`);
  }

  // Generate summary
  const summary = generateSummary(regionInfo.name, threatScore, agentReports, correlations);

  // Generate recommended actions
  const recommendedActions = generateRecommendations(threatScore, correlations);

  const analysis: AtlasAnalysis = {
    region,
    regionName: regionInfo.name,
    timestamp: new Date().toISOString(),
    agentReports,
    correlations,
    threatScore,
    summary,
    keyFindings,
    recommendedActions,
    totalExecutionTimeMs: Date.now() - startTime,
  };

  onEvent?.({
    type: 'complete',
    data: {
      threatScore,
      correlationsCount: correlations.correlatedPatterns.length,
    },
    timestamp: Date.now(),
  });

  return analysis;
}

function generateSummary(
  regionName: string,
  threatScore: number,
  reports: AgentReport[],
  correlations: CorrelationResult
): string {
  const level = threatScore >= 70 ? 'HIGH' : threatScore >= 40 ? 'ELEVATED' : 'MODERATE';

  const totalFindings = reports.reduce((sum, r) => sum + r.findings.length, 0);

  let summary = `${regionName} threat assessment: ${level} (${threatScore}/100). `;
  summary += `Analysis identified ${totalFindings} significant events across ${reports.length} intelligence domains. `;

  if (correlations.correlatedPatterns.length > 0) {
    summary += `Detected ${correlations.correlatedPatterns.length} cross-domain correlation(s) suggesting coordinated or cascading effects. `;
  }

  return summary;
}

function generateRecommendations(threatScore: number, correlations: CorrelationResult): string[] {
  const actions: string[] = [];

  if (threatScore >= 70) {
    actions.push('Enable continuous monitoring for this region');
    actions.push('Alert relevant stakeholders of elevated threat level');
  }

  if (threatScore >= 40) {
    actions.push('Increase monitoring frequency for key indicators');
  }

  if (correlations.correlatedPatterns.some(p => p.type === 'escalation')) {
    actions.push('Monitor for further escalation signals');
  }

  if (correlations.correlatedPatterns.some(p => p.type === 'economic-political')) {
    actions.push('Track economic indicators alongside political developments');
  }

  if (actions.length === 0) {
    actions.push('Continue standard monitoring protocols');
  }

  return actions;
}
