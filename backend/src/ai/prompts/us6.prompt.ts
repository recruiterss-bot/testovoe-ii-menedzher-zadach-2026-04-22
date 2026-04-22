import { PromptBuildResult } from './prompt.types';
import {
  asNumber,
  asRecord,
  buildSystemPrompt,
  stableJson,
} from './prompt.utils';

export function buildUS6Prompt(
  input: Record<string, unknown>,
): PromptBuildResult {
  const aggregate = asRecord(input.aggregate);
  const distribution = asRecord(aggregate.distribution);
  const status = asRecord(distribution.status);
  const priority = asRecord(distribution.priority);

  const context = {
    upcomingDays: asNumber(input.upcomingDays, 3),
    aggregate: {
      overdueCount: asNumber(aggregate.overdueCount, 0),
      upcomingCount: asNumber(aggregate.upcomingCount, 0),
      distribution: {
        status: {
          todo: asNumber(status.todo, 0),
          in_progress: asNumber(status.in_progress, 0),
          done: asNumber(status.done, 0),
        },
        priority: {
          low: asNumber(priority.low, 0),
          medium: asNumber(priority.medium, 0),
          high: asNumber(priority.high, 0),
        },
      },
    },
  };

  return {
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt([
          'Сценарий: US-6 (workload summary).',
          'Верни JSON строго формата: {"summary":"...","overdueCount":number,"upcomingCount":number,"distribution":{"status":{"todo":number,"in_progress":number,"done":number},"priority":{"low":number,"medium":number,"high":number}},"focus":["...", "..."]}.',
          'Все числа в ответе должны совпадать с входным aggregate.',
          'focus: от 1 до 3 практических рекомендаций.',
        ]),
      },
      {
        role: 'user',
        content: [
          'Входные данные:',
          stableJson(context),
          'Выходной контракт JSON: строго как в system prompt.',
          'Верни только JSON без дополнительного текста.',
        ].join('\n'),
      },
    ],
  };
}
