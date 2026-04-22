import { Injectable } from '@nestjs/common';
import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import { aiScenarioSchemas } from '../contracts/ai-schemas';
import { AIScenario } from '../domain/ai.types';

@Injectable()
export class AISchemaValidatorService {
  private readonly ajv = new Ajv({ allErrors: true });
  private readonly validators: Record<AIScenario, ValidateFunction> = {
    'US-3': this.ajv.compile(aiScenarioSchemas['US-3']),
    'US-4': this.ajv.compile(aiScenarioSchemas['US-4']),
    'US-5': this.ajv.compile(aiScenarioSchemas['US-5']),
    'US-6': this.ajv.compile(aiScenarioSchemas['US-6']),
  };

  validate(
    scenario: AIScenario,
    payload: unknown,
  ): {
    valid: boolean;
    errors: ErrorObject[] | null | undefined;
  } {
    const validator = this.validators[scenario];
    const valid = validator(payload) === true;

    return {
      valid,
      errors: validator.errors,
    };
  }

  getScenarioSchema(scenario: AIScenario): Record<string, unknown> {
    return aiScenarioSchemas[scenario];
  }
}
