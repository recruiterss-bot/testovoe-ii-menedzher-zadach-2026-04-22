import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  const service = new PromptBuilderService();

  it('builds US-3 prompt with few-shot examples and sanitized context', () => {
    const result = service.build('US-3', {
      task: {
        id: 'task-1',
        title: 'Подготовить презентацию',
        description: 'Собрать материалы',
        priority: 'high',
        status: 'todo',
        dueDate: null,
        internalSecret: 'must-not-leak',
      },
    });

    expect(result.messages.length).toBeGreaterThanOrEqual(6);
    expect(result.messages[0].role).toBe('system');

    const serialized = result.messages
      .map((message) => message.content)
      .join('\n');
    expect(serialized).toContain('"title": "Подготовить презентацию"');
    expect(serialized).not.toContain('internalSecret');

    const assistantExamples = result.messages.filter(
      (message) => message.role === 'assistant',
    );
    expect(assistantExamples.length).toBeGreaterThanOrEqual(2);
  });

  it('builds US-4 prompt with bounded maxSubtasks', () => {
    const result = service.build('US-4', {
      task: {
        id: 'task-2',
        title: 'Подготовить релиз',
      },
      options: {
        maxSubtasks: 50,
      },
    });

    const merged = result.messages.map((message) => message.content).join('\n');
    expect(merged).toContain('"maxSubtasks": 10');
  });

  it('builds US-6 prompt with numeric consistency constraint', () => {
    const result = service.build('US-6', {
      upcomingDays: 7,
      aggregate: {
        overdueCount: 2,
        upcomingCount: 4,
        distribution: {
          status: { todo: 3, in_progress: 2, done: 5 },
          priority: { low: 2, medium: 4, high: 4 },
        },
      },
    });

    expect(result.messages[0].content).toContain(
      'Все числа в ответе должны совпадать',
    );
    expect(result.messages[1].content).toContain('"upcomingDays": 7');
    expect(result.messages[1].content).toContain('"overdueCount": 2');
  });
});
