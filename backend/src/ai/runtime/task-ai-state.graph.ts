import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  AIExecutionRequest,
  AIProviderResponse,
  AIScenario,
  AIUsage,
} from '../domain/ai.types';
import { PromptBuilderService } from '../prompts/prompt-builder.service';
import { AI_PROVIDER_ADAPTER } from '../providers/ai-provider.adapter';
import type { AIProviderAdapter } from '../providers/ai-provider.adapter';
import { AISchemaValidatorService } from '../services/ai-schema-validator.service';

type GraphInput = {
  requestId: string;
  scenario: AIScenario;
  input: Record<string, unknown>;
  maxOutputTokens: number;
};

type GraphOutput = {
  data: unknown;
  usage: AIUsage;
};

type GraphState = {
  requestId: string;
  scenario: AIScenario;
  input: Record<string, unknown>;
  maxOutputTokens: number;
  language?: 'ru';
  responseSchema?: Record<string, unknown>;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  providerResponse?: AIProviderResponse;
  data?: unknown;
  usage?: AIUsage;
};

const TaskAIStateAnnotation = Annotation.Root({
  requestId: Annotation<string>(),
  scenario: Annotation<AIScenario>(),
  input: Annotation<Record<string, unknown>>(),
  maxOutputTokens: Annotation<number>(),
  language: Annotation<'ru'>(),
  responseSchema: Annotation<Record<string, unknown>>(),
  messages:
    Annotation<
      Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    >(),
  providerResponse: Annotation<AIProviderResponse>(),
  data: Annotation<unknown>(),
  usage: Annotation<AIUsage>(),
});

@Injectable()
export class TaskAIStateGraphService {
  private readonly graph = new StateGraph(TaskAIStateAnnotation)
    .addNode('load_context', (state: GraphState) => {
      return {
        requestId: state.requestId,
        scenario: state.scenario,
        input: state.input,
        maxOutputTokens: state.maxOutputTokens,
        language: 'ru' as const,
      };
    })
    .addNode('build_prompt', (state: GraphState) => {
      const promptBundle = this.promptBuilder.build(
        state.scenario,
        state.input,
      );
      return {
        messages: promptBundle.messages,
        responseSchema: this.schemaValidator.getScenarioSchema(state.scenario),
      };
    })
    .addNode('invoke_model', async (state: GraphState) => {
      const providerResponse = await this.provider.generate({
        scenario: state.scenario,
        input: state.input,
        maxOutputTokens: state.maxOutputTokens,
        language: state.language ?? 'ru',
        messages: state.messages ?? [],
        responseSchema: state.responseSchema ?? {},
      });

      return {
        providerResponse,
      };
    })
    .addNode('validate_schema', (state: GraphState) => {
      const output = state.providerResponse?.output;
      const validation = this.schemaValidator.validate(state.scenario, output);
      if (!validation.valid) {
        throw new BadRequestException({
          code: 'AI_INVALID_SCHEMA',
          message: 'AI response does not match expected schema',
          details: {
            scenario: state.scenario,
            requestId: state.requestId,
            errors: validation.errors ?? [],
          },
        });
      }

      return {};
    })
    .addNode('normalize_result', (state: GraphState) => {
      return {
        data: state.providerResponse?.output,
        usage: state.providerResponse?.usage,
      };
    })
    .addEdge(START, 'load_context')
    .addEdge('load_context', 'build_prompt')
    .addEdge('build_prompt', 'invoke_model')
    .addEdge('invoke_model', 'validate_schema')
    .addEdge('validate_schema', 'normalize_result')
    .addEdge('normalize_result', END)
    .compile();

  constructor(
    @Inject(AI_PROVIDER_ADAPTER)
    private readonly provider: AIProviderAdapter,
    private readonly promptBuilder: PromptBuilderService,
    private readonly schemaValidator: AISchemaValidatorService,
  ) {}

  async invoke(input: GraphInput): Promise<GraphOutput> {
    const result = (await this.graph.invoke(input)) as GraphState;

    if (result.usage === undefined) {
      throw new Error('AI graph did not produce usage metrics');
    }

    return {
      data: result.data,
      usage: result.usage,
    };
  }

  toGraphInput(
    requestId: string,
    request: AIExecutionRequest,
    maxOutputTokens: number,
  ): GraphInput {
    return {
      requestId,
      scenario: request.scenario,
      input: request.input,
      maxOutputTokens,
    };
  }
}
