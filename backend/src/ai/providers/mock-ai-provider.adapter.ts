import { Injectable } from '@nestjs/common';
import {
  AIProviderRequest,
  AIProviderResponse,
  AIScenario,
} from '../domain/ai.types';
import { AIProviderAdapter } from './ai-provider.adapter';

@Injectable()
export class MockAIProviderAdapter implements AIProviderAdapter {
  generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    return Promise.resolve({
      output: this.mockScenarioOutput(request.scenario),
      usage: {
        model: 'mock-model-v1',
        promptTokens: 120,
        completionTokens: 80,
        estimatedCostUsd: 0.0004,
      },
    });
  }

  private mockScenarioOutput(scenario: AIScenario): unknown {
    switch (scenario) {
      case 'US-3':
        return {
          kind: 'category',
          value: 'Работа',
          reason: 'Задача относится к рабочему процессу и имеет дедлайн.',
        };
      case 'US-4':
        return {
          subtasks: [
            {
              title: 'Уточнить входные данные',
              description: 'Собрать все необходимые зависимости.',
            },
            {
              title: 'Разбить задачу на этапы',
              description: 'Сделать 3-5 проверяемых шагов.',
            },
          ],
          reason: 'Декомпозиция снижает риск срыва сроков.',
        };
      case 'US-5':
        return {
          suggestedPriority: 'high',
          raisePriority: true,
          reason: 'Срок близко и задача блокирует последующие работы.',
        };
      case 'US-6':
        return {
          summary: 'Есть 2 просроченные задачи и 4 задачи на ближайшие 3 дня.',
          overdueCount: 2,
          upcomingCount: 4,
          distribution: {
            status: {
              todo: 3,
              in_progress: 4,
              done: 6,
            },
            priority: {
              low: 3,
              medium: 4,
              high: 6,
            },
          },
          focus: ['Сначала закрыть просроченные high-priority задачи.'],
        };
      default:
        return {};
    }
  }
}
