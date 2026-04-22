import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Task } from '@prisma/client';
import { IdempotencyService } from '../common/services/idempotency.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { SubtaskInputDto } from './dto/bulk-create-subtasks.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

type WorkloadDistribution = {
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

export type WorkloadAggregate = {
  overdueCount: number;
  upcomingCount: number;
  distribution: WorkloadDistribution;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(dto: CreateTaskDto): Promise<Task> {
    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: dto.parentTaskId },
        select: { id: true },
      });
      if (!parent) {
        throw this.validationError('Invalid parentTaskId', {
          field: 'parentTaskId',
        });
      }
    }

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority,
        status: dto.status,
        dueDate: dto.dueDate ?? null,
        parentTaskId: dto.parentTaskId ?? null,
      },
    });
  }

  async findAll(query: ListTasksQueryDto) {
    if (
      query.dueDateFrom &&
      query.dueDateTo &&
      query.dueDateFrom > query.dueDateTo
    ) {
      throw this.validationError(
        'dueDateFrom must be less than or equal dueDateTo',
        {
          field: 'dueDateFrom',
        },
      );
    }

    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } as Prisma.TaskOrderByWithRelationInput;
    const where = this.buildListWhereInput(query);

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        skip,
        take,
        orderBy,
        where,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({ where: { id } });

    if (!task) {
      throw this.taskNotFound(id);
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    if (
      dto.classificationKind !== undefined &&
      dto.classificationKind !== null &&
      (!dto.classificationValue || dto.classificationValue.trim().length === 0)
    ) {
      throw this.validationError(
        'classificationValue is required when classificationKind is provided',
        { field: 'classificationValue' },
      );
    }

    if (
      dto.classificationValue === null &&
      dto.classificationKind === undefined
    ) {
      throw this.validationError(
        'classificationKind must be provided as null when classificationValue is null',
        { field: 'classificationKind' },
      );
    }

    if (dto.classificationValue === null && dto.classificationKind !== null) {
      throw this.validationError(
        'classificationKind must be null when classificationValue is null',
        { field: 'classificationKind' },
      );
    }

    try {
      return await this.prisma.task.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          status: dto.status,
          dueDate: dto.dueDate,
          classificationKind: dto.classificationKind,
          classificationValue: dto.classificationValue,
        },
      });
    } catch (error) {
      if (this.isPrismaNotFoundError(error)) {
        throw this.taskNotFound(id);
      }
      throw error;
    }
  }

  async updateWithIdempotency(
    id: string,
    dto: UpdateTaskDto,
    idempotencyKey: string,
  ): Promise<Task> {
    const result = await this.idempotency.execute({
      scope: `PATCH:/tasks/${id}`,
      key: idempotencyKey,
      payload: dto,
      ttlMs: this.getIdempotencyTtlMs(),
      handler: async () => ({
        statusCode: 200,
        body: await this.update(id, dto),
      }),
    });

    return result.body;
  }

  async remove(id: string): Promise<void> {
    const childrenCount = await this.prisma.task.count({
      where: { parentTaskId: id },
    });

    if (childrenCount > 0) {
      throw this.validationError('Task has child subtasks', {
        code: 'PARENT_HAS_CHILDREN',
      });
    }

    try {
      await this.prisma.task.delete({ where: { id } });
    } catch (error) {
      if (this.isPrismaNotFoundError(error)) {
        throw this.taskNotFound(id);
      }
      throw error;
    }
  }

  async createSubtasksBulkWithIdempotency(
    parentTaskId: string,
    subtasks: SubtaskInputDto[],
    idempotencyKey: string,
  ): Promise<{ created: number; parentTaskId: string }> {
    const result = await this.idempotency.execute({
      scope: `POST:/tasks/${parentTaskId}/subtasks/bulk`,
      key: idempotencyKey,
      payload: subtasks,
      ttlMs: this.getIdempotencyTtlMs(),
      handler: async () => ({
        statusCode: 201,
        body: await this.createSubtasksBulk(parentTaskId, subtasks),
      }),
    });

    return result.body;
  }

  async createSubtasksBulk(
    parentTaskId: string,
    subtasks: SubtaskInputDto[],
  ): Promise<{ created: number; parentTaskId: string }> {
    const parentTask = await this.findOne(parentTaskId);
    const normalizedSubtasks = subtasks.map((subtask) => ({
      title: subtask.title.trim(),
      description: subtask.description?.trim() || null,
    }));

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.task.createMany({
        data: normalizedSubtasks.map((subtask) => ({
          title: subtask.title,
          description: subtask.description,
          priority: parentTask.priority,
          status: 'todo',
          parentTaskId: parentTask.id,
        })),
      });

      return {
        created: created.count,
        parentTaskId: parentTask.id,
      };
    });
  }

  async buildWorkloadAggregate(
    upcomingDays: number,
  ): Promise<WorkloadAggregate> {
    const now = new Date();
    const upcomingUntil = new Date(
      now.getTime() + upcomingDays * 24 * 60 * 60 * 1000,
    );

    const [overdueCount, upcomingCount, statusGroups, priorityGroups] =
      await Promise.all([
        this.prisma.task.count({
          where: {
            dueDate: { lt: now },
            status: { not: 'done' },
          },
        }),
        this.prisma.task.count({
          where: {
            dueDate: { gte: now, lte: upcomingUntil },
            status: { not: 'done' },
          },
        }),
        this.prisma.task.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ['priority'],
          _count: { _all: true },
        }),
      ]);

    const distribution: WorkloadDistribution = {
      status: {
        todo: 0,
        in_progress: 0,
        done: 0,
      },
      priority: {
        low: 0,
        medium: 0,
        high: 0,
      },
    };

    for (const group of statusGroups) {
      distribution.status[group.status] = group._count._all;
    }

    for (const group of priorityGroups) {
      distribution.priority[group.priority] = group._count._all;
    }

    return {
      overdueCount,
      upcomingCount,
      distribution,
    };
  }

  private taskNotFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'TASK_NOT_FOUND',
      message: 'Task not found',
      details: { taskId: id },
    });
  }

  private validationError(
    message: string,
    details: Record<string, unknown>,
  ): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message,
      details,
    });
  }

  private isPrismaNotFoundError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private buildListWhereInput(query: ListTasksQueryDto): Prisma.TaskWhereInput {
    const and: Prisma.TaskWhereInput[] = [];

    if (query.status) {
      and.push({ status: query.status });
    }

    if (query.priority) {
      and.push({ priority: query.priority });
    }

    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (query.dueDateFrom || query.dueDateTo) {
      and.push({
        dueDate: {
          gte: query.dueDateFrom,
          lte: query.dueDateTo,
        },
      });
    }

    if (query.isOverdue === true) {
      and.push({
        dueDate: { lt: new Date() },
      });
      and.push({
        status: { not: 'done' },
      });
    }

    if (query.isOverdue === false) {
      and.push({
        OR: [
          { dueDate: null },
          { dueDate: { gte: new Date() } },
          { status: 'done' },
        ],
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private getIdempotencyTtlMs(): number {
    const ttlHours = this.configService.get<number>('AI_IDEMPOTENCY_TTL_HOURS');
    return (ttlHours ?? 24) * 60 * 60 * 1000;
  }
}
