import { Injectable } from '@nestjs/common';
import { AIScenario } from '../domain/ai.types';
import { PromptBuildResult } from './prompt.types';
import { buildUS3Prompt } from './us3.prompt';
import { buildUS4Prompt } from './us4.prompt';
import { buildUS5Prompt } from './us5.prompt';
import { buildUS6Prompt } from './us6.prompt';

@Injectable()
export class PromptBuilderService {
  build(
    scenario: AIScenario,
    input: Record<string, unknown>,
  ): PromptBuildResult {
    switch (scenario) {
      case 'US-3':
        return buildUS3Prompt(input);
      case 'US-4':
        return buildUS4Prompt(input);
      case 'US-5':
        return buildUS5Prompt(input);
      case 'US-6':
        return buildUS6Prompt(input);
      default:
        return {
          messages: [
            {
              role: 'system',
              content: 'Верни только JSON.',
            },
          ],
        };
    }
  }
}
