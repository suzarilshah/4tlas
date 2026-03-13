/**
 * ATLAS Cross-Domain Correlation Engine
 * Detects patterns and correlations across GeoInt, FinInt, and ThreatInt findings
 */

import type { AgentReport, AgentFinding } from './orchestrator';

// ============================================================================
// TYPES
// ============================================================================

export interface CorrelatedPattern {
  type: 'escalation' | 'economic-political' | 'cyber-kinetic' | 'cascade' | 'coordinated';
  description: string;
  confidence: number; // 0-100
  involvedAgents: string[];
  involvedFindings: AgentFinding[];
  riskMultiplier: number; // How much this pattern multiplies base risk
}

export interface CorrelationResult {
  correlatedPatterns: CorrelatedPattern[];
  signalStrength: number; // 0-100, overall correlation strength
  cascadeRisk: 'low' | 'medium' | 'high';
  analysisNotes: string[];
}

// ============================================================================
// CORRELATION RULES
// ============================================================================

interface CorrelationRule {
  name: string;
  type: CorrelatedPattern['type'];
  description: string;
  check: (reports: AgentReport[]) => CorrelatedPattern | null;
}

const CORRELATION_RULES: CorrelationRule[] = [
  {
    name: 'Economic-Political Stress',
    type: 'economic-political',
    description: 'Currency/market stress coinciding with protests or political instability',
    check: (reports) => {
      const geoInt = reports.find(r => r.agentName === 'GeoInt');
      const finInt = reports.find(r => r.agentName === 'FinInt');

      if (!geoInt || !finInt) return null;

      const protests = geoInt.findings.filter(f =>
        f.category === 'protest' || f.category === 'civil_unrest'
      );
      const economicStress = finInt.findings.filter(f =>
        f.category === 'currency' || f.category === 'inflation' ||
        (f.severity >= 6 && f.category === 'commodity')
      );

      if (protests.length > 0 && economicStress.length > 0) {
        const avgSeverity = (
          protests.reduce((s, f) => s + f.severity, 0) / protests.length +
          economicStress.reduce((s, f) => s + f.severity, 0) / economicStress.length
        ) / 2;

        return {
          type: 'economic-political',
          description: `Economic stress (${economicStress.length} signals) correlating with civil unrest (${protests.length} events) - classic instability pattern`,
          confidence: Math.min(90, avgSeverity * 10),
          involvedAgents: ['GeoInt', 'FinInt'],
          involvedFindings: [...protests, ...economicStress],
          riskMultiplier: 1.3,
        };
      }

      return null;
    },
  },
  {
    name: 'Cyber-Kinetic Convergence',
    type: 'cyber-kinetic',
    description: 'Cyber attacks coinciding with physical conflict or military activity',
    check: (reports) => {
      const geoInt = reports.find(r => r.agentName === 'GeoInt');
      const threatInt = reports.find(r => r.agentName === 'ThreatInt');

      if (!geoInt || !threatInt) return null;

      const conflicts = geoInt.findings.filter(f =>
        f.category === 'armed_conflict' || f.category === 'military_posturing'
      );
      const cyberThreats = threatInt.findings.filter(f =>
        f.category === 'apt_activity' || f.category === 'infrastructure' ||
        f.category === 'cyber_attack'
      );

      if (conflicts.length > 0 && cyberThreats.length > 0) {
        const avgSeverity = (
          conflicts.reduce((s, f) => s + f.severity, 0) / conflicts.length +
          cyberThreats.reduce((s, f) => s + f.severity, 0) / cyberThreats.length
        ) / 2;

        return {
          type: 'cyber-kinetic',
          description: `Cyber operations (${cyberThreats.length} indicators) detected alongside kinetic activity (${conflicts.length} events) - potential coordinated campaign`,
          confidence: Math.min(85, avgSeverity * 10),
          involvedAgents: ['GeoInt', 'ThreatInt'],
          involvedFindings: [...conflicts, ...cyberThreats],
          riskMultiplier: 1.5,
        };
      }

      return null;
    },
  },
  {
    name: 'Escalation Spiral',
    type: 'escalation',
    description: 'Multiple high-severity events across domains suggesting escalation',
    check: (reports) => {
      const highSeverityFindings: AgentFinding[] = [];
      const involvedAgents: string[] = [];

      for (const report of reports) {
        const severe = report.findings.filter(f => f.severity >= 7);
        if (severe.length > 0) {
          highSeverityFindings.push(...severe);
          involvedAgents.push(report.agentName);
        }
      }

      if (involvedAgents.length >= 2 && highSeverityFindings.length >= 3) {
        return {
          type: 'escalation',
          description: `Multiple high-severity events (${highSeverityFindings.length}) across ${involvedAgents.length} domains - escalation risk elevated`,
          confidence: Math.min(95, highSeverityFindings.length * 15),
          involvedAgents,
          involvedFindings: highSeverityFindings,
          riskMultiplier: 1.4,
        };
      }

      return null;
    },
  },
  {
    name: 'Cascade Effect',
    type: 'cascade',
    description: 'Events in one domain likely to trigger effects in others',
    check: (reports) => {
      const geoInt = reports.find(r => r.agentName === 'GeoInt');
      const finInt = reports.find(r => r.agentName === 'FinInt');
      const threatInt = reports.find(r => r.agentName === 'ThreatInt');

      if (!geoInt || !finInt || !threatInt) return null;

      // Check for energy-related cascade
      const energyConflict = geoInt.findings.find(f =>
        f.details?.toLowerCase().includes('oil') ||
        f.details?.toLowerCase().includes('gas') ||
        f.details?.toLowerCase().includes('pipeline') ||
        f.details?.toLowerCase().includes('strait')
      );
      const commoditySpike = finInt.findings.find(f =>
        f.category === 'commodity' && f.severity >= 6
      );
      const infraThreat = threatInt.findings.find(f =>
        f.category === 'infrastructure' ||
        f.details?.toLowerCase().includes('energy') ||
        f.details?.toLowerCase().includes('scada')
      );

      if (energyConflict && commoditySpike) {
        const findings = [energyConflict, commoditySpike];
        if (infraThreat) findings.push(infraThreat);

        return {
          type: 'cascade',
          description: `Energy sector cascade detected: conflict/tension affecting commodity prices${infraThreat ? ' with infrastructure targeting' : ''}`,
          confidence: 75,
          involvedAgents: infraThreat
            ? ['GeoInt', 'FinInt', 'ThreatInt']
            : ['GeoInt', 'FinInt'],
          involvedFindings: findings,
          riskMultiplier: 1.35,
        };
      }

      return null;
    },
  },
  {
    name: 'Coordinated Activity',
    type: 'coordinated',
    description: 'Timing suggests coordinated multi-domain activity',
    check: (reports) => {
      // Check for events occurring within a short time window across agents
      const recentFindings: Array<{ finding: AgentFinding; agent: string }> = [];

      for (const report of reports) {
        for (const finding of report.findings) {
          if (finding.timestamp) {
            const findingTime = new Date(finding.timestamp).getTime();
            const hoursAgo = (Date.now() - findingTime) / (1000 * 60 * 60);

            if (hoursAgo <= 24 && finding.severity >= 5) {
              recentFindings.push({ finding, agent: report.agentName });
            }
          }
        }
      }

      const uniqueAgents = [...new Set(recentFindings.map(rf => rf.agent))];

      if (uniqueAgents.length >= 2 && recentFindings.length >= 3) {
        return {
          type: 'coordinated',
          description: `${recentFindings.length} significant events across ${uniqueAgents.length} domains in last 24 hours - potential coordination`,
          confidence: Math.min(70, recentFindings.length * 12),
          involvedAgents: uniqueAgents,
          involvedFindings: recentFindings.map(rf => rf.finding),
          riskMultiplier: 1.25,
        };
      }

      return null;
    },
  },
];

// ============================================================================
// MAIN CORRELATION FUNCTION
// ============================================================================

export function correlateFindings(reports: AgentReport[]): CorrelationResult {
  const correlatedPatterns: CorrelatedPattern[] = [];
  const analysisNotes: string[] = [];

  // Run all correlation rules
  for (const rule of CORRELATION_RULES) {
    const pattern = rule.check(reports);
    if (pattern) {
      correlatedPatterns.push(pattern);
      analysisNotes.push(`Detected ${rule.name}: ${pattern.description}`);
    }
  }

  // Calculate overall signal strength
  const signalStrength = correlatedPatterns.length > 0
    ? Math.min(100, correlatedPatterns.reduce((sum, p) => sum + p.confidence, 0) / correlatedPatterns.length)
    : 0;

  // Determine cascade risk
  let cascadeRisk: 'low' | 'medium' | 'high' = 'low';
  if (correlatedPatterns.some(p => p.type === 'cascade' || p.type === 'escalation')) {
    cascadeRisk = 'high';
  } else if (correlatedPatterns.length >= 2) {
    cascadeRisk = 'medium';
  }

  // Add summary notes
  if (correlatedPatterns.length === 0) {
    analysisNotes.push('No significant cross-domain correlations detected');
  } else {
    analysisNotes.push(
      `Total correlations: ${correlatedPatterns.length}, ` +
      `Average confidence: ${Math.round(signalStrength)}%`
    );
  }

  return {
    correlatedPatterns,
    signalStrength,
    cascadeRisk,
    analysisNotes,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate combined risk multiplier from all correlations
 */
export function calculateRiskMultiplier(correlations: CorrelationResult): number {
  if (correlations.correlatedPatterns.length === 0) {
    return 1.0;
  }

  // Combine multipliers (diminishing returns)
  let multiplier = 1.0;
  for (const pattern of correlations.correlatedPatterns) {
    multiplier *= 1 + (pattern.riskMultiplier - 1) * 0.7;
  }

  return Math.min(2.5, multiplier); // Cap at 2.5x
}

/**
 * Get a human-readable correlation summary
 */
export function getCorrelationSummary(correlations: CorrelationResult): string {
  if (correlations.correlatedPatterns.length === 0) {
    return 'Analysis found isolated events with no significant cross-domain patterns.';
  }

  const topPattern = correlations.correlatedPatterns
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!topPattern) {
    return 'Analysis found isolated events with no significant cross-domain patterns.';
  }

  return `Detected ${correlations.correlatedPatterns.length} cross-domain pattern(s). ` +
    `Primary pattern: ${topPattern.description} (${topPattern.confidence}% confidence). ` +
    `Cascade risk: ${correlations.cascadeRisk.toUpperCase()}.`;
}
