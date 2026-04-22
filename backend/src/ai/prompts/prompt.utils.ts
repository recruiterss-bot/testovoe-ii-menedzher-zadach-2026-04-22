const COMMON_SYSTEM_PROMPT = [
  'Ты AI-ассистент менеджера задач.',
  'Отвечай только на русском языке.',
  'Запрещено писать текст вне JSON.',
  'Запрещены markdown, комментарии и префиксы.',
  'US-3/US-4/US-5: только suggestion, без автоприменения изменений.',
].join('\n');

export function buildSystemPrompt(extraRules: string[]): string {
  return [COMMON_SYSTEM_PROMPT, ...extraRules].join('\n');
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return '';
}

export function asNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return null;
}

export function asNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
