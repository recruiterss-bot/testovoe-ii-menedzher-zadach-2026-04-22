import { PromptBuildResult } from './prompt.types';
import {
  asNullableString,
  asNumber,
  asRecord,
  asString,
  buildSystemPrompt,
  stableJson,
} from './prompt.utils';

export function buildUS4Prompt(
  input: Record<string, unknown>,
): PromptBuildResult {
  const task = asRecord(input.task);
  const options = asRecord(input.options);
  const maxSubtasks = Math.max(
    1,
    Math.min(10, asNumber(options.maxSubtasks, 6)),
  );

  const context = {
    task: {
      id: asString(task.id),
      title: asString(task.title),
      description: asNullableString(task.description),
      priority: asString(task.priority),
      status: asString(task.status),
      dueDate: asNullableString(task.dueDate),
    },
    constraints: {
      minSubtasks: 1,
      maxSubtasks,
      noAutoApply: true,
    },
  };

  return {
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt([
          'Сценарий: US-4 (decomposition suggestion).',
          'Верни JSON строго формата: {"subtasks":[{"title":"...","description":"...|null"}],"reason":"..."}.',
          'Количество subtasks в диапазоне 1..maxSubtasks из входного контекста.',
          'Подзадачи должны быть проверяемыми и применимыми в рабочем контексте.',
        ]),
      },
      {
        role: 'user',
        content: [
          'Пример входа:',
          '{"task":{"id":"t1","title":"Подготовить релиз","description":"Нужно запустить новую версию","priority":"high","status":"todo","dueDate":"2026-05-03T09:00:00.000Z"},"constraints":{"minSubtasks":1,"maxSubtasks":4,"noAutoApply":true}}',
          'Верни только JSON.',
        ].join('\n'),
      },
      {
        role: 'assistant',
        content:
          '{"subtasks":[{"title":"Согласовать scope релиза","description":"Подтвердить список изменений с командой"},{"title":"Проверить критические сценарии","description":"Прогнать smoke и regression тесты"},{"title":"Подготовить план выката","description":"Определить окно релиза и rollback шаги"}],"reason":"Декомпозиция уменьшает риск срыва релиза и упрощает контроль прогресса."}',
      },
      {
        role: 'user',
        content: [
          'Пример входа:',
          '{"task":{"id":"t2","title":"Подготовить стенд для демо","description":"Нужно настроить окружение","priority":"medium","status":"in_progress","dueDate":null},"constraints":{"minSubtasks":1,"maxSubtasks":3,"noAutoApply":true}}',
          'Верни только JSON.',
        ].join('\n'),
      },
      {
        role: 'assistant',
        content:
          '{"subtasks":[{"title":"Собрать конфигурацию стенда","description":"Проверить версии сервисов и переменные окружения"},{"title":"Загрузить тестовые данные","description":"Подготовить демонстрационный набор задач"},{"title":"Проверить сценарий демо","description":"Пройти пользовательский путь от создания до AI-подсказок"}],"reason":"Пошаговая структура позволяет стабильно подготовить стенд и избежать сбоев во время показа."}',
      },
      {
        role: 'user',
        content: [
          'Входные данные:',
          stableJson(context),
          'Выходной контракт JSON: {"subtasks":[{"title":"строка","description":"строка|null"}],"reason":"строка"}.',
          'Верни только JSON без дополнительного текста.',
        ].join('\n'),
      },
    ],
  };
}
