/**
 * ATLAS - Autonomous Threat & Landscape Analysis System
 * Multi-agent intelligence orchestration for World Monitor
 */

export { AzureFoundryClient, createAzureClient } from './azure-foundry';
export type {
  AzureConfig,
  AgentMessage,
  ToolCall,
  ToolDefinition,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './azure-foundry';

export {
  ATLAS_REGIONS,
  GEOINT_TOOLS,
  FININT_TOOLS,
  THREATINT_TOOLS,
  ORCHESTRATOR_TOOLS,
  AGENT_PROMPTS,
} from './agent-functions';
export type { AtlasRegion } from './agent-functions';

export { analyzeRegion } from './orchestrator';
export type {
  AgentFinding,
  AgentReport,
  AtlasAnalysis,
  AtlasEvent,
} from './orchestrator';

export {
  correlateFindings,
  calculateRiskMultiplier,
  getCorrelationSummary,
} from './correlator';
export type { CorrelatedPattern, CorrelationResult } from './correlator';
