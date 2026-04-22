import { Injectable } from '@nestjs/common';
import { AI_SCENARIOS, AIScenario, AIUsage } from '../domain/ai.types';

type ScenarioMetrics = {
  ai_requests_total: number;
  ai_errors_total: number;
  ai_latency_ms_total: number;
  ai_prompt_tokens_total: number;
  ai_completion_tokens_total: number;
  ai_estimated_cost_total: number;
};

@Injectable()
export class AIMetricsService {
  private readonly metrics: Record<AIScenario, ScenarioMetrics>;

  constructor() {
    this.metrics = AI_SCENARIOS.reduce(
      (acc, scenario) => ({
        ...acc,
        [scenario]: {
          ai_requests_total: 0,
          ai_errors_total: 0,
          ai_latency_ms_total: 0,
          ai_prompt_tokens_total: 0,
          ai_completion_tokens_total: 0,
          ai_estimated_cost_total: 0,
        },
      }),
      {} as Record<AIScenario, ScenarioMetrics>,
    );
  }

  recordRequest(scenario: AIScenario): void {
    this.metrics[scenario].ai_requests_total += 1;
  }

  recordSuccess(scenario: AIScenario, latencyMs: number, usage: AIUsage): void {
    this.metrics[scenario].ai_latency_ms_total += latencyMs;
    this.metrics[scenario].ai_prompt_tokens_total += usage.promptTokens;
    this.metrics[scenario].ai_completion_tokens_total += usage.completionTokens;
    this.metrics[scenario].ai_estimated_cost_total += usage.estimatedCostUsd;
  }

  recordError(scenario: AIScenario): void {
    this.metrics[scenario].ai_errors_total += 1;
  }

  snapshot(): Record<AIScenario, ScenarioMetrics> {
    return this.metrics;
  }
}
