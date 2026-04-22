import { AIProviderRequest, AIProviderResponse } from '../domain/ai.types';

export interface AIProviderAdapter {
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
}

export const AI_PROVIDER_ADAPTER = Symbol('AI_PROVIDER_ADAPTER');
