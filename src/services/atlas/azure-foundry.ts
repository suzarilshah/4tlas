/**
 * ATLAS - Azure AI Foundry Client
 * Uses Azure OpenAI REST API for multi-agent orchestration
 * Compatible with Cloudflare Workers runtime
 */

export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion?: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface ChatCompletionRequest {
  messages: AgentMessage[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: AgentMessage;
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Azure OpenAI client for ATLAS multi-agent system
 */
export class AzureFoundryClient {
  private config: Required<AzureConfig>;

  constructor(config: AzureConfig) {
    this.config = {
      ...config,
      apiVersion: config.apiVersion || '2024-08-01-preview',
    };
  }

  /**
   * Create a chat completion with optional tool/function calling
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = `${this.config.endpoint}/openai/deployments/${this.config.deployment}/chat/completions?api-version=${this.config.apiVersion}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        ...request,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Execute a multi-turn conversation with tool calling
   * Handles the tool call loop automatically
   */
  async executeWithTools(
    systemPrompt: string,
    userMessage: string,
    tools: ToolDefinition[],
    toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>,
    maxIterations = 5
  ): Promise<{
    finalResponse: string;
    toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }>;
    usage: { promptTokens: number; completionTokens: number };
  }> {
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const allToolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }> = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.createChatCompletion({
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response choice from Azure OpenAI');
      }

      totalPromptTokens += response.usage.prompt_tokens;
      totalCompletionTokens += response.usage.completion_tokens;

      // If no tool calls, we're done
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
        return {
          finalResponse: choice.message.content || '',
          toolCalls: allToolCalls,
          usage: {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
          },
        };
      }

      // Add assistant message with tool calls
      messages.push(choice.message);

      // Execute each tool call
      for (const toolCall of choice.message.tool_calls ?? []) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await toolExecutor(toolCall.function.name, args);

        allToolCalls.push({
          name: toolCall.function.name,
          args,
          result,
        });

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    // Max iterations reached
    return {
      finalResponse: 'Analysis incomplete - maximum iterations reached.',
      toolCalls: allToolCalls,
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
      },
    };
  }
}

/**
 * Create Azure Foundry client from environment
 */
export function createAzureClient(env: {
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
}): AzureFoundryClient | null {
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
    return null;
  }

  return new AzureFoundryClient({
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    apiKey: env.AZURE_OPENAI_API_KEY,
    deployment: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  });
}
