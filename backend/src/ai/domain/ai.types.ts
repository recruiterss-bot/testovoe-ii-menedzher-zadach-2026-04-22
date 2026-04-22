export const AI_SCENARIOS = ['US-3', 'US-4', 'US-5', 'US-6'] as const;
export type AIScenario = (typeof AI_SCENARIOS)[number];

export type AIMessageRole = 'system' | 'user' | 'assistant';

export type AIPromptMessage = {
  role: AIMessageRole;
  content: string;
};

export type AIExecutionRequest = {
  scenario: AIScenario;
  input: Record<string, unknown>;
};

export type AIUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
};

export type AIProviderRequest = AIExecutionRequest & {
  maxOutputTokens: number;
  language: 'ru';
  messages: AIPromptMessage[];
  responseSchema: Record<string, unknown>;
};

export type AIProviderResponse = {
  output: unknown;
  usage: AIUsage;
};

export type AIExecutionResult<T = unknown> = {
  requestId: string;
  scenario: AIScenario;
  data: T;
  usage: AIUsage;
};
