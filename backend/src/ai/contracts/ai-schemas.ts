export const aiScenarioSchemas = {
  'US-3': {
    type: 'object',
    required: ['kind', 'value', 'reason'],
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['category', 'tag'] },
      value: { type: 'string', minLength: 1, maxLength: 64 },
      reason: { type: 'string', minLength: 3, maxLength: 220 },
    },
  },
  'US-4': {
    type: 'object',
    required: ['subtasks', 'reason'],
    additionalProperties: false,
    properties: {
      subtasks: {
        type: 'array',
        minItems: 1,
        maxItems: 10,
        items: {
          type: 'object',
          required: ['title'],
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 140 },
            description: {
              anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }],
            },
          },
        },
      },
      reason: { type: 'string', minLength: 3, maxLength: 220 },
    },
  },
  'US-5': {
    type: 'object',
    required: ['suggestedPriority', 'raisePriority', 'reason'],
    additionalProperties: false,
    properties: {
      suggestedPriority: { type: 'string', enum: ['low', 'medium', 'high'] },
      raisePriority: { type: 'boolean' },
      reason: { type: 'string', minLength: 3, maxLength: 220 },
    },
  },
  'US-6': {
    type: 'object',
    required: [
      'summary',
      'overdueCount',
      'upcomingCount',
      'distribution',
      'focus',
    ],
    additionalProperties: false,
    properties: {
      summary: { type: 'string', minLength: 8, maxLength: 500 },
      overdueCount: { type: 'integer', minimum: 0 },
      upcomingCount: { type: 'integer', minimum: 0 },
      distribution: {
        type: 'object',
        required: ['status', 'priority'],
        additionalProperties: false,
        properties: {
          status: {
            type: 'object',
            required: ['todo', 'in_progress', 'done'],
            additionalProperties: false,
            properties: {
              todo: { type: 'integer', minimum: 0 },
              in_progress: { type: 'integer', minimum: 0 },
              done: { type: 'integer', minimum: 0 },
            },
          },
          priority: {
            type: 'object',
            required: ['low', 'medium', 'high'],
            additionalProperties: false,
            properties: {
              low: { type: 'integer', minimum: 0 },
              medium: { type: 'integer', minimum: 0 },
              high: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
      focus: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: { type: 'string', minLength: 3, maxLength: 180 },
      },
    },
  },
} as const;
