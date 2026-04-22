import { AIPromptMessage } from '../domain/ai.types';

export type PromptBuildResult = {
  messages: AIPromptMessage[];
};

export type PromptBuilderFn = (
  input: Record<string, unknown>,
) => PromptBuildResult;
