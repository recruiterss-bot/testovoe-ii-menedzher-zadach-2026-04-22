import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptBuilderService } from '../prompts/prompt-builder.service';
import { AIProviderAdapter } from '../providers/ai-provider.adapter';
import { MockAIProviderAdapter } from '../providers/mock-ai-provider.adapter';
import { TaskAIStateGraphService } from '../runtime/task-ai-state.graph';
import { AIMetricsService } from './ai-metrics.service';
import { AIOrchestratorService } from './ai-orchestrator.service';
import { AISchemaValidatorService } from './ai-schema-validator.service';

describe('AIOrchestratorService', () => {
  const schemaValidator = new AISchemaValidatorService();

  it('runs all scenarios through mock provider', async () => {
    const service = createOrchestrator({
      provider: new MockAIProviderAdapter(),
      retryCount: 1,
      timeoutMs: 100,
    });

    await expect(
      service.executeScenario({ scenario: 'US-3', input: { title: 'Task' } }),
    ).resolves.toMatchObject({ scenario: 'US-3' });
    await expect(
      service.executeScenario({ scenario: 'US-4', input: { title: 'Task' } }),
    ).resolves.toMatchObject({ scenario: 'US-4' });
    await expect(
      service.executeScenario({ scenario: 'US-5', input: { title: 'Task' } }),
    ).resolves.toMatchObject({ scenario: 'US-5' });
    await expect(
      service.executeScenario({ scenario: 'US-6', input: { title: 'Task' } }),
    ).resolves.toMatchObject({ scenario: 'US-6' });
  });

  it('rejects invalid AI schema output', async () => {
    const provider: AIProviderAdapter = {
      generate: () =>
        Promise.resolve({
          output: { invalid: true },
          usage: {
            model: 'mock-model',
            promptTokens: 1,
            completionTokens: 1,
            estimatedCostUsd: 0.00001,
          },
        }),
    };
    const service = createOrchestrator({
      provider,
      retryCount: 1,
      timeoutMs: 100,
    });

    await expect(
      service.executeScenario({ scenario: 'US-3', input: { title: 'Task' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.executeScenario({ scenario: 'US-3', input: { title: 'Task' } }),
    ).rejects.toMatchObject({
      response: { code: 'AI_INVALID_SCHEMA' },
    });
  });

  it('retries on timeout and then returns AI_TIMEOUT', async () => {
    let callCount = 0;
    const provider: AIProviderAdapter = {
      generate: async () => {
        callCount += 1;
        return new Promise(() => {
          return;
        });
      },
    };
    const service = createOrchestrator({
      provider,
      retryCount: 1,
      timeoutMs: 20,
    });

    await expect(
      service.executeScenario({ scenario: 'US-5', input: { title: 'Task' } }),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(callCount).toBe(2);
  });

  it('retries transient provider error once and succeeds', async () => {
    let callCount = 0;
    const provider: AIProviderAdapter = {
      generate: () => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error('network'));
        }

        return Promise.resolve({
          output: {
            suggestedPriority: 'high',
            raisePriority: true,
            reason: 'Срок близко.',
          },
          usage: {
            model: 'mock-model',
            promptTokens: 10,
            completionTokens: 20,
            estimatedCostUsd: 0.0002,
          },
        });
      },
    };
    const metrics = new AIMetricsService();
    const service = createOrchestrator({
      provider,
      retryCount: 1,
      timeoutMs: 50,
      metrics,
    });

    const result = await service.executeScenario({
      scenario: 'US-5',
      input: { title: 'Task' },
    });

    expect(result.scenario).toBe('US-5');
    expect(callCount).toBe(2);
    expect(metrics.snapshot()['US-5'].ai_requests_total).toBe(2);
  });

  it('returns AI_UNAVAILABLE after retries are exhausted', async () => {
    let callCount = 0;
    const provider: AIProviderAdapter = {
      generate: () => {
        callCount += 1;
        return Promise.reject(new Error('provider down'));
      },
    };
    const service = createOrchestrator({
      provider,
      retryCount: 1,
      timeoutMs: 50,
    });

    await expect(
      service.executeScenario({ scenario: 'US-6', input: { title: 'Task' } }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    await expect(
      service.executeScenario({ scenario: 'US-6', input: { title: 'Task' } }),
    ).rejects.toMatchObject({
      response: { code: 'AI_UNAVAILABLE' },
    });
    expect(callCount).toBe(4);
  });

  function createOrchestrator(params: {
    provider: AIProviderAdapter;
    timeoutMs: number;
    retryCount: number;
    metrics?: AIMetricsService;
  }): AIOrchestratorService {
    const config = {
      get: (key: string) => {
        switch (key) {
          case 'AI_TIMEOUT_MS':
            return params.timeoutMs;
          case 'AI_RETRY_COUNT':
            return params.retryCount;
          case 'AI_MAX_OUTPUT_TOKENS_US3':
            return 120;
          case 'AI_MAX_OUTPUT_TOKENS_US5':
            return 140;
          case 'AI_MAX_OUTPUT_TOKENS_US4':
            return 500;
          case 'AI_MAX_OUTPUT_TOKENS_US6':
            return 350;
          default:
            return undefined;
        }
      },
    } as ConfigService;
    const taskAIStateGraph = new TaskAIStateGraphService(
      params.provider,
      new PromptBuilderService(),
      schemaValidator,
    );

    return new AIOrchestratorService(
      config,
      taskAIStateGraph,
      params.metrics ?? new AIMetricsService(),
    );
  }
});
