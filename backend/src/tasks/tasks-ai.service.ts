import { Injectable } from '@nestjs/common';
import { AIOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { TasksService } from './tasks.service';

type CategorySuggestion = {
  kind: 'category' | 'tag';
  value: string;
  reason: string;
};

type PrioritySuggestion = {
  suggestedPriority: 'low' | 'medium' | 'high';
  raisePriority: boolean;
  reason: string;
};

type DecompositionSuggestion = {
  subtasks: Array<{
    title: string;
    description: string | null;
  }>;
  reason: string;
};

type WorkloadSummarySuggestion = {
  summary: string;
  overdueCount: number;
  upcomingCount: number;
  distribution: {
    status: {
      todo: number;
      in_progress: number;
      done: number;
    };
    priority: {
      low: number;
      medium: number;
      high: number;
    };
  };
  focus: string[];
};

@Injectable()
export class TasksAiService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly orchestrator: AIOrchestratorService,
  ) {}

  async generateCategorySuggestion(taskId: string) {
    const task = await this.tasksService.findOne(taskId);
    const result = await this.orchestrator.executeScenario<CategorySuggestion>({
      scenario: 'US-3',
      input: {
        task: this.toAiTaskInput(task),
      },
    });

    return {
      suggestion: result.data,
      meta: {
        scenario: result.scenario,
        requestId: result.requestId,
      },
    };
  }

  async generatePrioritySuggestion(taskId: string) {
    const task = await this.tasksService.findOne(taskId);
    const result = await this.orchestrator.executeScenario<PrioritySuggestion>({
      scenario: 'US-5',
      input: {
        task: this.toAiTaskInput(task),
      },
    });

    return {
      suggestion: result.data,
      meta: {
        scenario: result.scenario,
        requestId: result.requestId,
      },
    };
  }

  async generateDecomposition(taskId: string, maxSubtasks: number) {
    const task = await this.tasksService.findOne(taskId);
    const result =
      await this.orchestrator.executeScenario<DecompositionSuggestion>({
        scenario: 'US-4',
        input: {
          task: this.toAiTaskInput(task),
          options: {
            maxSubtasks,
          },
        },
      });

    return {
      suggestion: result.data,
      meta: {
        scenario: result.scenario,
        requestId: result.requestId,
      },
    };
  }

  async generateWorkloadSummary(upcomingDays: number) {
    const aggregate =
      await this.tasksService.buildWorkloadAggregate(upcomingDays);
    const result =
      await this.orchestrator.executeScenario<WorkloadSummarySuggestion>({
        scenario: 'US-6',
        input: {
          aggregate,
          upcomingDays,
        },
      });

    return {
      summary: this.buildWorkloadSummaryText(aggregate, upcomingDays),
      overdueCount: aggregate.overdueCount,
      upcomingCount: aggregate.upcomingCount,
      distribution: aggregate.distribution,
      focus: result.data.focus,
      meta: {
        scenario: result.scenario,
        requestId: result.requestId,
      },
    };
  }

  private buildWorkloadSummaryText(
    aggregate: Awaited<ReturnType<TasksService['buildWorkloadAggregate']>>,
    upcomingDays: number,
  ): string {
    return `Есть ${aggregate.overdueCount} просроченные задачи и ${aggregate.upcomingCount} задачи на ближайшие ${upcomingDays} ${this.getRussianDayWord(upcomingDays)}.`;
  }

  private getRussianDayWord(days: number): string {
    const mod10 = days % 10;
    const mod100 = days % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return 'день';
    }

    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
      return 'дня';
    }

    return 'дней';
  }

  private toAiTaskInput(task: Awaited<ReturnType<TasksService['findOne']>>) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    };
  }
}
