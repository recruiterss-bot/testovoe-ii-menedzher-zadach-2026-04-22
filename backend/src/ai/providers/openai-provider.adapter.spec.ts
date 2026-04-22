import { ConfigService } from '@nestjs/config';
import { AIProviderRequest } from '../domain/ai.types';
import { OpenAIProviderAdapter } from './openai-provider.adapter';

describe('OpenAIProviderAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses JSON from Responses API output_text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          output_text:
            '{"kind":"category","value":"Работа","reason":"Срок близко."}',
          usage: {
            input_tokens: 120,
            output_tokens: 80,
          },
        }),
    }) as typeof fetch;

    const adapter = createAdapter({
      OPENAI_API_KEY: 'test-key',
      AI_MODEL_PRIMARY: 'gpt-4',
    });

    const response = await adapter.generate(baseRequest('US-3'));

    expect(response.output).toEqual({
      kind: 'category',
      value: 'Работа',
      reason: 'Срок близко.',
    });
    expect(response.usage.promptTokens).toBe(120);
    expect(response.usage.completionTokens).toBe(80);
    expect(response.usage.model).toBe('gpt-4');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('supports chat completion shaped payload fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content:
                  '{"suggestedPriority":"high","raisePriority":true,"reason":"Блокирующая задача."}',
              },
            },
          ],
          usage: {
            prompt_tokens: 11,
            completion_tokens: 9,
          },
        }),
    }) as typeof fetch;

    const adapter = createAdapter({
      OPENAI_API_KEY: 'test-key',
      AI_MODEL_PRIMARY: 'gpt-4',
    });

    const response = await adapter.generate(baseRequest('US-5'));

    expect(response.output).toEqual({
      suggestedPriority: 'high',
      raisePriority: true,
      reason: 'Блокирующая задача.',
    });
    expect(response.usage.promptTokens).toBe(11);
    expect(response.usage.completionTokens).toBe(9);
  });

  it('throws provider error for non-2xx status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({}),
    }) as typeof fetch;

    const adapter = createAdapter({
      OPENAI_API_KEY: 'test-key',
      AI_MODEL_PRIMARY: 'gpt-4',
    });

    await expect(adapter.generate(baseRequest('US-6'))).rejects.toThrow(
      'OpenAI request failed with status 429',
    );
  });

  function createAdapter(
    values: Record<string, string>,
  ): OpenAIProviderAdapter {
    const config = {
      get: (key: string) => values[key],
    } as ConfigService;

    return new OpenAIProviderAdapter(config);
  }

  function baseRequest(
    scenario: AIProviderRequest['scenario'],
  ): AIProviderRequest {
    return {
      scenario,
      input: { foo: 'bar' },
      language: 'ru',
      maxOutputTokens: 128,
      responseSchema: {
        type: 'object',
      },
      messages: [
        {
          role: 'system',
          content: 'Верни JSON.',
        },
        {
          role: 'user',
          content: 'Тест',
        },
      ],
    };
  }
});
