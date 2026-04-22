import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptBuilderService } from './prompts/prompt-builder.service';
import { AI_PROVIDER_ADAPTER } from './providers/ai-provider.adapter';
import { MockAIProviderAdapter } from './providers/mock-ai-provider.adapter';
import { OpenAIProviderAdapter } from './providers/openai-provider.adapter';
import { TaskAIStateGraphService } from './runtime/task-ai-state.graph';
import { AIMetricsService } from './services/ai-metrics.service';
import { AIOrchestratorService } from './services/ai-orchestrator.service';
import { AISchemaValidatorService } from './services/ai-schema-validator.service';

@Module({
  providers: [
    AISchemaValidatorService,
    PromptBuilderService,
    OpenAIProviderAdapter,
    MockAIProviderAdapter,
    TaskAIStateGraphService,
    AIOrchestratorService,
    AIMetricsService,
    {
      provide: AI_PROVIDER_ADAPTER,
      useFactory: (
        configService: ConfigService,
        openaiProvider: OpenAIProviderAdapter,
        mockProvider: MockAIProviderAdapter,
      ) => {
        const logger = new Logger('AIProviderFactory');
        const configuredProvider =
          configService.get<string>('AI_PROVIDER_DEFAULT')?.toLowerCase() ??
          'openai';
        const hasOpenAIKey =
          (configService.get<string>('OPENAI_API_KEY')?.trim().length ?? 0) > 0;

        if (configuredProvider === 'openai' && hasOpenAIKey) {
          return openaiProvider;
        }

        if (configuredProvider === 'openai' && !hasOpenAIKey) {
          logger.warn(
            'OPENAI_API_KEY is missing; falling back to mock AI provider.',
          );
        }

        return mockProvider;
      },
      inject: [ConfigService, OpenAIProviderAdapter, MockAIProviderAdapter],
    },
  ],
  exports: [AIOrchestratorService, AIMetricsService],
})
export class AiModule {}
