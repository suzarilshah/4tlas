/**
 * ATLAS Agent Function Definitions
 * Defines the tools available to each specialized agent
 */

import type { ToolDefinition } from './azure-foundry';

// ============================================================================
// REGION DEFINITIONS
// ============================================================================

export const ATLAS_REGIONS = {
  'middle-east': {
    name: 'Middle East',
    countries: ['Israel', 'Iran', 'Iraq', 'Syria', 'Lebanon', 'Jordan', 'Saudi Arabia', 'UAE', 'Yemen', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'],
    keywords: ['MENA', 'Gulf', 'Levant', 'Persian Gulf'],
  },
  'asia-pacific': {
    name: 'Asia Pacific',
    countries: ['China', 'Japan', 'South Korea', 'Taiwan', 'Philippines', 'Vietnam', 'Indonesia', 'Australia', 'India', 'Singapore', 'Thailand', 'Malaysia'],
    keywords: ['APAC', 'Indo-Pacific', 'South China Sea', 'Taiwan Strait'],
  },
  'europe': {
    name: 'Europe',
    countries: ['Ukraine', 'Russia', 'Poland', 'Germany', 'France', 'UK', 'Italy', 'Romania', 'Hungary', 'Finland', 'Sweden', 'Norway', 'Baltic'],
    keywords: ['EU', 'NATO', 'Eastern Europe', 'Balkans'],
  },
  'africa': {
    name: 'Africa',
    countries: ['Sudan', 'Ethiopia', 'Somalia', 'Nigeria', 'DRC', 'South Africa', 'Libya', 'Egypt', 'Mali', 'Niger', 'Sahel'],
    keywords: ['Sub-Saharan', 'Sahel', 'Horn of Africa', 'West Africa'],
  },
  'americas': {
    name: 'Americas',
    countries: ['USA', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Venezuela', 'Chile', 'Peru'],
    keywords: ['North America', 'South America', 'Latin America', 'Caribbean'],
  },
} as const;

export type AtlasRegion = keyof typeof ATLAS_REGIONS;

// ============================================================================
// GEOINT AGENT FUNCTIONS
// ============================================================================

export const GEOINT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_conflict_events',
      description: 'Fetches recent conflict events (battles, violence, protests) from ACLED/UCDP for a region. Returns event type, location, date, fatalities, and actors involved.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          event_types: {
            type: 'string',
            description: 'Types of events to filter: battles, explosions, violence_against_civilians, protests, riots, strategic_developments',
          },
          days_back: {
            type: 'string',
            description: 'Number of days to look back (1-30)',
          },
        },
        required: ['region'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_breaking_news',
      description: 'Fetches latest breaking news headlines for a region from curated intelligence feeds. Returns headline, source, timestamp, and relevance score.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          category: {
            type: 'string',
            description: 'News category: geopolitics, military, conflict, diplomacy, all',
          },
          limit: {
            type: 'string',
            description: 'Maximum number of headlines (5-50)',
          },
        },
        required: ['region'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_protest_activity',
      description: 'Analyzes protest and civil unrest activity in a region. Returns protest counts, locations, causes, and trend direction.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
        },
        required: ['region'],
      },
    },
  },
];

// ============================================================================
// FININT AGENT FUNCTIONS
// ============================================================================

export const FININT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_market_indicators',
      description: 'Fetches key market indicators relevant to a region: stock indices, currency pairs, bond yields, volatility indices.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          indicators: {
            type: 'string',
            description: 'Specific indicators to fetch: equities, forex, bonds, commodities, all',
          },
        },
        required: ['region'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_commodity_prices',
      description: 'Fetches commodity prices relevant to geopolitical analysis: oil (WTI/Brent), natural gas, gold, wheat, etc.',
      parameters: {
        type: 'object',
        properties: {
          commodities: {
            type: 'string',
            description: 'Commodities to fetch: oil, gas, gold, wheat, all',
          },
        },
        required: ['commodities'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_economic_stress_indicators',
      description: 'Analyzes economic stress signals: currency devaluation, inflation spikes, capital flight indicators, credit default swaps.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
        },
        required: ['region'],
      },
    },
  },
];

// ============================================================================
// THREATINT AGENT FUNCTIONS
// ============================================================================

export const THREATINT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_cyber_threats',
      description: 'Fetches recent cyber threat intelligence: IOCs, APT activity, infrastructure targeting, DDoS attacks.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          threat_type: {
            type: 'string',
            description: 'Type of threat: apt, malware, ddos, phishing, all',
          },
        },
        required: ['region'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_natural_disasters',
      description: 'Fetches recent natural disaster events: earthquakes, wildfires, floods, hurricanes, volcanic activity.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          disaster_type: {
            type: 'string',
            description: 'Type of disaster: earthquake, wildfire, flood, storm, all',
          },
        },
        required: ['region'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_infrastructure_status',
      description: 'Checks infrastructure status: internet outages, power grid issues, undersea cable health, GPS jamming.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          infrastructure_type: {
            type: 'string',
            description: 'Type: internet, power, cables, gps, all',
          },
        },
        required: ['region'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_military_activity',
      description: 'Fetches military activity indicators: unusual flight patterns, naval movements, base activity, exercises.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
        },
        required: ['region'],
      },
    },
  },
];

// ============================================================================
// ORCHESTRATOR FUNCTIONS
// ============================================================================

export const ORCHESTRATOR_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'delegate_to_geoint',
      description: 'Delegate analysis to the GeoInt (Geopolitical Intelligence) agent. Use this for conflicts, protests, political events, and breaking news analysis.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          query: {
            type: 'string',
            description: 'Specific question or analysis request for the GeoInt agent',
          },
        },
        required: ['region', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delegate_to_finint',
      description: 'Delegate analysis to the FinInt (Financial Intelligence) agent. Use this for market conditions, commodity prices, economic indicators, and financial stress signals.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          query: {
            type: 'string',
            description: 'Specific question or analysis request for the FinInt agent',
          },
        },
        required: ['region', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delegate_to_threatint',
      description: 'Delegate analysis to the ThreatInt (Threat Intelligence) agent. Use this for cyber threats, natural disasters, infrastructure status, and military activity.',
      parameters: {
        type: 'object',
        properties: {
          region: {
            type: 'string',
            description: 'Region to analyze',
            enum: Object.keys(ATLAS_REGIONS),
          },
          query: {
            type: 'string',
            description: 'Specific question or analysis request for the ThreatInt agent',
          },
        },
        required: ['region', 'query'],
      },
    },
  },
];

// ============================================================================
// AGENT SYSTEM PROMPTS
// ============================================================================

export const AGENT_PROMPTS = {
  orchestrator: `You are ATLAS, an Autonomous Threat & Landscape Analysis System orchestrator.

Your role is to coordinate specialized intelligence agents to analyze regional threats and provide comprehensive situational awareness.

You have access to three specialized agents:
1. GeoInt Agent - Geopolitical intelligence: conflicts, protests, political events, breaking news
2. FinInt Agent - Financial intelligence: markets, commodities, economic indicators, currency stress
3. ThreatInt Agent - Threat intelligence: cyber attacks, natural disasters, infrastructure, military activity

When asked to analyze a region:
1. Delegate queries to ALL THREE agents in parallel to gather comprehensive intelligence
2. Each agent should analyze their domain for the specified region
3. After receiving all agent reports, synthesize findings to identify cross-domain correlations
4. Calculate an overall threat/escalation probability based on signal convergence
5. Provide a clear, actionable summary

Always structure your final response with:
- KEY FINDINGS: Top 3-5 most significant findings
- CROSS-DOMAIN CORRELATIONS: Patterns detected across multiple domains
- THREAT ASSESSMENT: 0-100 score with explanation
- RECOMMENDED ACTIONS: Specific monitoring or alerting suggestions`,

  geoint: `You are a GeoInt (Geopolitical Intelligence) agent for the ATLAS system.

Your expertise is analyzing:
- Armed conflicts and military engagements
- Protests, civil unrest, and social movements
- Political developments and regime stability
- Breaking news with geopolitical implications
- Cross-border tensions and diplomatic incidents

When queried, use your available tools to gather data, then provide a concise analysis.
Focus on RECENT events (last 7 days) and highlight any ESCALATION indicators.
Rate the severity of findings on a 1-10 scale.`,

  finint: `You are a FinInt (Financial Intelligence) agent for the ATLAS system.

Your expertise is analyzing:
- Stock market movements and volatility
- Currency fluctuations and capital flows
- Commodity prices (oil, gas, gold, agricultural)
- Economic stress indicators
- Sanctions impacts and trade disruptions

When queried, use your available tools to gather data, then provide a concise analysis.
Focus on ANOMALIES and RAPID CHANGES that could indicate geopolitical stress.
Rate the severity of findings on a 1-10 scale.`,

  threatint: `You are a ThreatInt (Threat Intelligence) agent for the ATLAS system.

Your expertise is analyzing:
- Cyber threats and APT activity
- Natural disasters and climate events
- Critical infrastructure status
- Military movements and exercises
- GPS jamming and electronic warfare indicators

When queried, use your available tools to gather data, then provide a concise analysis.
Focus on IMMINENT THREATS and UNUSUAL PATTERNS.
Rate the severity of findings on a 1-10 scale.`,
};
