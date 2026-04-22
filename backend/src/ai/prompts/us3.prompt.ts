import { PromptBuildResult } from './prompt.types';
import {
  asNullableString,
  asRecord,
  asString,
  buildSystemPrompt,
  stableJson,
} from './prompt.utils';

export function buildUS3Prompt(
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
      mode: 'category_or_tag',
      noAutoApply: true,
    },
  };

  return {
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt([
          'Сценарий: US-3 (category/tag suggestion).',
          'Верни JSON строго формата: {"kind":"category|tag","value":"...","reason":"..."}.',
          'kind только category или tag.',
          'reason должен быть кратким и деловым.',
        ]),
      },
      {
        role: 'user',
        content: [
          'Пример входа:',
          '{"task":{"id":"t1","title":"Подготовить квартальный бюджет","description":"Согласовать суммы с финдиром","priority":"high","status":"todo","dueDate":"2026-04-30T12:00:00.000Z"},"policy":{"mode":"category_or_tag","noAutoApply":true}}',
          'Верни только JSON.',
        ].join('\n'),
      },
      {
        role: 'assistant',
        content:
          '{"kind":"category","value":"Финансы","reason":"Задача относится к финансовому планированию и согласованию бюджета."}',
      },
      {
        role: 'user',
        content: [
          'Пример входа:',
          '{"task":{"id":"t2","title":"Подготовить анонс митапа","description":"Собрать хештеги и площадки","priority":"medium","status":"in_progress","dueDate":null},"policy":{"mode":"category_or_tag","noAutoApply":true}}',
          'Верни только JSON.',
        ].join('\n'),
      },
      {
        role: 'assistant',
        content:
          '{"kind":"tag","value":"Коммуникации","reason":"Фокус задачи на информационном анонсе и публикациях."}',
      },
      {
        role: 'user',
        content: [
          'Входные данные:',
          stableJson(context),
          'Выходной контракт JSON: {"kind":"category|tag","value":"строка","reason":"строка"}.',
          'Верни только JSON без дополнительного текста.',
        ].join('\n'),
      },
    ],
  };
}
