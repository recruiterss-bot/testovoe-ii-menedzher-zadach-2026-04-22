import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AIExecutionRequest,
  AIExecutionResult,
  AIScenario,
} from '../domain/ai.types';
import { TaskAIStateGraphService } from '../runtime/task-ai-state.graph';
import { AIMetricsService } from './ai-metrics.service';

type NormalizedError = {
  code: 'AI_TIMEOUT' | 'AI_UNAVAILABLE';
  retryable: boolean;
  message: string;
};

class AIRequestTimeoutError extends Error {}

@Injectable()
export class AIOrchestratorService {
  private readonly logger = new Logger(AIOrchestratorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly taskAIStateGraph: TaskAIStateGraphService,
    private readonly metrics: AIMetricsService,
  ) {}

  async executeScenario<T = unknown>(
    request: AIExecutionRequest,
  ): Promise<AIExecutionResult<T>> {
    const requestId = randomUUID();
    const timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS') ?? 20_000;
    const retryCount = this.configService.get<number>('AI_RETRY_COUNT') ?? 1;
    const maxOutputTokens = this.getMaxOutputTokensByScenario(request.scenario);

    let attempt = 0;
    let lastError: unknown;
    const startedAt = Date.now();

    while (attempt <= retryCount) {
      attempt += 1;
      this.metrics.recordRequest(request.scenario);

      try {
        const response = await this.withTimeout(
          this.taskAIStateGraph.invoke(
            this.taskAIStateGraph.toGraphInput(
              requestId,
              request,
              maxOutputTokens,
            ),
          ),
          timeoutMs,
        );

        this.metrics.recordSuccess(
          request.scenario,
          Date.now() - startedAt,
          response.usage,
        );

        this.logger.log(
          JSON.stringify({
            requestId,
            scenario: request.scenario,
            model: response.usage.model,
            latencyMs: Date.now() - startedAt,
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            estimatedCostUsd: response.usage.estimatedCostUsd,
            resultStatus: 'SUCCESS',
          }),
        );

        return {
          requestId,
          scenario: request.scenario,
          data: response.data as T,
          usage: response.usage,
        };
      } catch (error) {
        lastError = error;
        const normalized = this.normalizeProviderError(error);

        if (
          normalized &&
          normalized.retryable &&
          attempt <= retryCount &&
          attempt >= 1
        ) {
          this.logger.warn(
            JSON.stringify({
              requestId,
              scenario: request.scenario,
              attempt,
              resultStatus: 'RETRY',
              reason: normalized.code,
            }),
          );
          continue;
        }

        if (normalized) {
          this.metrics.recordError(request.scenario);
          this.logger.warn(
            JSON.stringify({
              requestId,
              scenario: request.scenario,
              attempt,
              resultStatus: normalized.code,
              message: normalized.message,
            }),
          );
          this.throwNormalizedError(
            normalized,
            request.scenario,
            requestId,
            attempt,
          );
        }

        if (error instanceof BadRequestException) {
          this.logger.warn(
            JSON.stringify({
              requestId,
              scenario: request.scenario,
              attempt,
              resultStatus: 'AI_INVALID_SCHEMA',
            }),
          );
        }

        throw error;
      }
    }

    this.metrics.recordError(request.scenario);
    this.throwNormalizedError(
      this.normalizeProviderError(lastError) ?? {
        code: 'AI_UNAVAILABLE',
        retryable: false,
        message: 'AI provider unavailable',
      },
      request.scenario,
      requestId,
      attempt,
    );
  }

  private throwNormalizedError(
    normalized: NormalizedError,
    scenario: AIScenario,
    requestId: string,
    attempt: number,
  ): never {
    const payload = {
      code: normalized.code,
      message: normalized.message,
      details: {
        scenario,
        requestId,
        attempt,
      },
    };

    if (normalized.code === 'AI_TIMEOUT') {
      throw new GatewayTimeoutException(payload);
    }

    throw new BadGatewayException(payload);
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new AIRequestTimeoutError('AI request timeout'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private normalizeProviderError(error: unknown): NormalizedError | null {
    if (error instanceof AIRequestTimeoutError) {
      return {
        code: 'AI_TIMEOUT',
        retryable: true,
        message: 'AI request timeout',
      };
    }

    if (error instanceof BadRequestException) {
      return null;
    }

    return {
      code: 'AI_UNAVAILABLE',
      retryable: true,
      message: 'AI provider unavailable',
    };
  }

  private getMaxOutputTokensByScenario(scenario: AIScenario): number {
    switch (scenario) {
      case 'US-3':
        return (
          this.configService.get<number>('AI_MAX_OUTPUT_TOKENS_US3') ?? 120
        );
      case 'US-5':
        return (
          this.configService.get<number>('AI_MAX_OUTPUT_TOKENS_US5') ?? 140
        );
      case 'US-4':
        return (
          this.configService.get<number>('AI_MAX_OUTPUT_TOKENS_US4') ?? 500
        );
      case 'US-6':
        return (
          this.configService.get<number>('AI_MAX_OUTPUT_TOKENS_US6') ?? 350
        );
      default:
        return 120;
    }
  }
}
