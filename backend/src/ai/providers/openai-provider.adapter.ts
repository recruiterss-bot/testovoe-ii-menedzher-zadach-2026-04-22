import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIProviderRequest,
  AIProviderResponse,
  AIScenario,
} from '../domain/ai.types';
import { AIProviderAdapter } from './ai-provider.adapter';

@Injectable()
export class OpenAIProviderAdapter implements AIProviderAdapter {
  constructor(private readonly configService: ConfigService) {}

  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const model = this.resolveModel(request.scenario);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: request.messages,
        max_output_tokens: request.maxOutputTokens,
        text: {
          format: {
            type: 'json_schema',
            name: `${request.scenario.toLowerCase()}_response`,
            schema: request.responseSchema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const textPayload = this.extractTextPayload(payload);

    let output: unknown;
    try {
      output = JSON.parse(textPayload);
    } catch {
      throw new Error('OpenAI returned non-JSON output');
    }

    const usageTokens = this.extractUsageTokens(payload);
    return {
      output,
      usage: {
        model,
        promptTokens: usageTokens.promptTokens,
        completionTokens: usageTokens.completionTokens,
        estimatedCostUsd: this.estimateCostUsd(
          model,
          usageTokens.promptTokens,
          usageTokens.completionTokens,
        ),
      },
    };
  }

  private resolveModel(scenario: AIScenario): string {
    const primary = this.configService.get<string>('AI_MODEL_PRIMARY')?.trim();
    const economy = this.configService.get<string>('AI_MODEL_ECONOMY')?.trim();
    const quality = this.configService.get<string>('AI_MODEL_QUALITY')?.trim();

    if (scenario === 'US-3' || scenario === 'US-5') {
      return economy || primary || 'gpt-4';
    }

    return quality || primary || 'gpt-4';
  }

  private extractTextPayload(payload: Record<string, unknown>): string {
    const outputText = payload.output_text;
    if (typeof outputText === 'string' && outputText.trim().length > 0) {
      return outputText;
    }

    const output = this.asArray(payload.output);
    for (const item of output) {
      const outputItem = this.asRecord(item);
      const content = this.asArray(outputItem.content);
      for (const part of content) {
        const contentPart = this.asRecord(part);
        const text = contentPart.text;

        if (typeof text === 'string' && text.trim().length > 0) {
          return text;
        }

        const nestedText = this.asRecord(text).value;
        if (typeof nestedText === 'string' && nestedText.trim().length > 0) {
          return nestedText;
        }
      }

      if (
        typeof outputItem.text === 'string' &&
        outputItem.text.trim().length > 0
      ) {
        return outputItem.text;
      }
    }

    const choices = this.asArray(payload.choices);
    for (const choice of choices) {
      const message = this.asRecord(this.asRecord(choice).message);
      const content = message.content;

      if (typeof content === 'string' && content.trim().length > 0) {
        return content;
      }

      for (const part of this.asArray(content)) {
        const text = this.asRecord(part).text;
        if (typeof text === 'string' && text.trim().length > 0) {
          return text;
        }
      }
    }

    throw new Error('OpenAI response does not contain text payload');
  }

  private extractUsageTokens(payload: Record<string, unknown>): {
    promptTokens: number;
    completionTokens: number;
  } {
    const usage = this.asRecord(payload.usage);

    const promptTokens = this.toNumber(
      usage.input_tokens ?? usage.prompt_tokens,
      0,
    );
    const completionTokens = this.toNumber(
      usage.output_tokens ?? usage.completion_tokens,
      0,
    );

    return {
      promptTokens,
      completionTokens,
    };
  }

  private estimateCostUsd(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const configuredInput = this.toOptionalNumber(
      this.configService.get<string>('AI_PRICE_INPUT_PER_MTOK_USD'),
    );
    const configuredOutput = this.toOptionalNumber(
      this.configService.get<string>('AI_PRICE_OUTPUT_PER_MTOK_USD'),
    );

    const defaultPricing = this.defaultPricingPerMTok(model);
    const inputPrice = configuredInput ?? defaultPricing.input;
    const outputPrice = configuredOutput ?? defaultPricing.output;

    const promptCost = (promptTokens / 1_000_000) * inputPrice;
    const completionCost = (completionTokens / 1_000_000) * outputPrice;

    return Number((promptCost + completionCost).toFixed(6));
  }

  private defaultPricingPerMTok(model: string): {
    input: number;
    output: number;
  } {
    if (model.includes('gpt-4')) {
      return { input: 30, output: 60 };
    }

    return { input: 5, output: 15 };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }

    return [];
  }

  private toNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private toOptionalNumber(value: string | undefined): number | null {
    if (!value || value.trim().length === 0) {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed;
  }
}
