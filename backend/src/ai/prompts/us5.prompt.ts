import { PromptBuildResult } from './prompt.types';
import {
  asNullableString,
  asRecord,
  asString,
  buildSystemPrompt,
  stableJson,
} from './prompt.utils';

export function buildUS5Prompt(
  input: Record<string, unknown>,
): PromptBuildResult {
  const task = asRecord(input.task);
  const context = {
    task: {
      id: asString(task.id),
      title: asString(task.title),
      description: asNullableString(task.description),
      priority: asString(task.priority),
      status: asString(task.status),
      dueDate: asNullableString(task.dueDate),
    },
    policy: {
      noAutoApply: true,
      allowedPriorities: ['low', 'medium', 'high'],
    },
  };

  return {
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt([
          'Сценарий: US-5 (priority suggestion).',
          'Верни JSON строго формата: {"suggestedPriority":"low|medium|high","raisePriority":true|false,"reason":"..."}.',
          'raisePriority=true только если есть ясное основание повысить приоритет.',
        ]),
      },
      {
        role: 'user',
        content: [
          'Входные данные:',
          stableJson(context),
          'Выходной контракт JSON: {"suggestedPriority":"low|medium|high","raisePriority":boolean,"reason":"строка"}.',
          'Верни только JSON без дополнительного текста.',
        ].join('\n'),
      },
    ],
  };
}
