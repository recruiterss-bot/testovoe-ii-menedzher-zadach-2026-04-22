import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import request from 'supertest';
import { createTestApp } from './create-test-app';

describe('Tasks CRUD integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await clearTasks(prisma);
  });

  afterAll(async () => {
    await clearTasks(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it('creates and returns task by id', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Сделать демо',
      priority: 'high',
      status: 'todo',
      description: 'Подготовить материалы',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual(
      expect.objectContaining({
        title: 'Сделать демо',
        priority: 'high',
        status: 'todo',
        description: 'Подготовить материалы',
      }),
    );

    const createdTask = await prisma.task.findFirst({
      where: { title: 'Сделать демо' },
      select: { id: true },
    });
    expect(createdTask).not.toBeNull();

    const getRes = await request(server).get(
      `/api/v1/tasks/${createdTask?.id as string}`,
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(
      expect.objectContaining({
        id: createdTask?.id,
      }),
    );
  });

  it('returns VALIDATION_ERROR for invalid payload', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server).post('/api/v1/tasks').send({
      title: '',
      priority: 'high',
      status: 'todo',
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('returns TASK_NOT_FOUND for unknown id on get and patch', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const getRes = await request(server).get('/api/v1/tasks/task_missing');
    expect(getRes.status).toBe(404);
    expect(getRes.body).toMatchObject({
      error: { code: 'TASK_NOT_FOUND' },
    });

    const patchRes = await request(server)
      .patch('/api/v1/tasks/task_missing')
      .send({ title: 'Новое название' });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body).toMatchObject({
      error: { code: 'TASK_NOT_FOUND' },
    });
  });

  it('returns parent-has-children validation error on delete', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).post('/api/v1/tasks').send({
      title: 'Родительская задача',
      priority: 'medium',
      status: 'todo',
    });
    const parent = await prisma.task.findFirst({
      where: { title: 'Родительская задача' },
      select: { id: true },
    });
    expect(parent).not.toBeNull();

    await request(server)
      .post('/api/v1/tasks')
      .send({
        title: 'Подзадача',
        priority: 'low',
        status: 'todo',
        parentTaskId: parent?.id as string,
      });

    const deleteParentRes = await request(server).delete(
      `/api/v1/tasks/${parent?.id as string}`,
    );
    expect(deleteParentRes.status).toBe(400);
    expect(deleteParentRes.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: { code: 'PARENT_HAS_CHILDREN' },
      },
    });
  });

  it('lists tasks with pagination metadata', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).post('/api/v1/tasks').send({
      title: 'Task 1',
      priority: 'low',
      status: 'todo',
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Task 2',
      priority: 'medium',
      status: 'in_progress',
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Task 3',
      priority: 'high',
      status: 'done',
    });

    const listRes = await request(server).get(
      '/api/v1/tasks?page=1&pageSize=2&sortBy=createdAt&sortOrder=desc',
    );

    expect(listRes.status).toBe(200);
    expect(listRes.body).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    const listBody = listRes.body as { items?: unknown };
    expect(Array.isArray(listBody.items)).toBe(true);
  });

  it('filters by status and priority combination', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).post('/api/v1/tasks').send({
      title: 'Todo high',
      priority: 'high',
      status: 'todo',
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Done high',
      priority: 'high',
      status: 'done',
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Todo low',
      priority: 'low',
      status: 'todo',
    });

    const res = await request(server).get(
      '/api/v1/tasks?status=todo&priority=high',
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 1,
    });
  });

  it('searches in title and description by q', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).post('/api/v1/tasks').send({
      title: 'Подготовить релиз',
      priority: 'medium',
      status: 'todo',
      description: 'Согласовать чеклист выкладки',
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Домашние дела',
      priority: 'low',
      status: 'todo',
      description: 'Купить продукты',
    });

    const byTitleRes = await request(server).get('/api/v1/tasks?q=релиз');
    expect(byTitleRes.status).toBe(200);
    expect(byTitleRes.body).toMatchObject({
      total: 1,
    });

    const byDescriptionRes = await request(server).get(
      '/api/v1/tasks?q=чеклист',
    );
    expect(byDescriptionRes.status).toBe(200);
    expect(byDescriptionRes.body).toMatchObject({
      total: 1,
    });
  });

  it('validates dueDate range and returns VALIDATION_ERROR', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const res = await request(server).get(
      '/api/v1/tasks?dueDateFrom=2026-05-10T00:00:00.000Z&dueDateTo=2026-05-01T00:00:00.000Z',
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('applies isOverdue rule: dueDate < now && status != done', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const now = Date.now();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    await request(server).post('/api/v1/tasks').send({
      title: 'Просроченная',
      priority: 'high',
      status: 'todo',
      dueDate: yesterday,
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Будущая',
      priority: 'medium',
      status: 'todo',
      dueDate: tomorrow,
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Закрытая просроченная',
      priority: 'low',
      status: 'done',
      dueDate: yesterday,
    });

    const overdueRes = await request(server).get(
      '/api/v1/tasks?isOverdue=true',
    );
    expect(overdueRes.status).toBe(200);
    expect(overdueRes.body).toMatchObject({
      total: 1,
    });
  });

  it('generates category suggestion without mutating task', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Подготовить митап',
      priority: 'medium',
      status: 'todo',
      description: 'Сделать презентацию и анонс',
    });

    const createdTask = createRes.body as { id: string };
    const suggestionRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/ai/category-suggestion`)
      .send({
        mode: 'category_or_tag',
        language: 'ru',
      });

    expect(suggestionRes.status).toBe(200);
    const suggestionBody = suggestionRes.body as {
      suggestion?: { kind?: string; value?: unknown; reason?: unknown };
      meta?: { scenario?: string; requestId?: unknown };
    };
    expect(['category', 'tag']).toContain(suggestionBody.suggestion?.kind);
    expect(typeof suggestionBody.suggestion?.value).toBe('string');
    expect(typeof suggestionBody.suggestion?.reason).toBe('string');
    expect(suggestionBody.meta?.scenario).toBe('US-3');
    expect(typeof suggestionBody.meta?.requestId).toBe('string');

    const storedTask = await prisma.task.findUnique({
      where: { id: createdTask.id },
      select: { classificationKind: true, classificationValue: true },
    });

    expect(storedTask).toMatchObject({
      classificationKind: null,
      classificationValue: null,
    });
  });

  it('applies category suggestion only via explicit PATCH apply action', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Подготовить отчёт',
      priority: 'high',
      status: 'todo',
    });
    const createdTask = createRes.body as { id: string };

    const suggestionRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/ai/category-suggestion`)
      .send({
        mode: 'category_or_tag',
        language: 'ru',
      });
    const suggestion = suggestionRes.body as {
      suggestion: { kind: 'category' | 'tag'; value: string };
    };

    const applyRes = await request(server)
      .patch(`/api/v1/tasks/${createdTask.id}`)
      .set('Idempotency-Key', `us3-apply-${createdTask.id}`)
      .send({
        classificationKind: suggestion.suggestion.kind,
        classificationValue: suggestion.suggestion.value,
      });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body).toMatchObject({
      classificationKind: suggestion.suggestion.kind,
      classificationValue: suggestion.suggestion.value,
    });
  });

  it('generates priority suggestion without mutating priority', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Собрать релиз',
      priority: 'low',
      status: 'todo',
    });
    const createdTask = createRes.body as { id: string };

    const suggestionRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/ai/priority-suggestion`)
      .send({
        language: 'ru',
      });

    expect(suggestionRes.status).toBe(200);
    const body = suggestionRes.body as {
      suggestion?: {
        suggestedPriority?: string;
        raisePriority?: unknown;
        reason?: unknown;
      };
      meta?: { scenario?: string; requestId?: unknown };
    };
    expect(['low', 'medium', 'high']).toContain(
      body.suggestion?.suggestedPriority,
    );
    expect(typeof body.suggestion?.raisePriority).toBe('boolean');
    expect(typeof body.suggestion?.reason).toBe('string');
    expect(body.meta?.scenario).toBe('US-5');
    expect(typeof body.meta?.requestId).toBe('string');

    const storedTask = await prisma.task.findUnique({
      where: { id: createdTask.id },
      select: { priority: true },
    });
    expect(storedTask?.priority).toBe('low');
  });

  it('applies priority suggestion only via explicit PATCH apply action', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Срочная задача',
      priority: 'low',
      status: 'todo',
    });
    const createdTask = createRes.body as { id: string };

    const suggestionRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/ai/priority-suggestion`)
      .send({
        language: 'ru',
      });
    const suggestion = suggestionRes.body as {
      suggestion: { suggestedPriority: 'low' | 'medium' | 'high' };
    };

    const applyRes = await request(server)
      .patch(`/api/v1/tasks/${createdTask.id}`)
      .set('Idempotency-Key', `us5-apply-${createdTask.id}`)
      .send({
        priority: suggestion.suggestion.suggestedPriority,
      });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body).toMatchObject({
      priority: suggestion.suggestion.suggestedPriority,
    });
  });

  it('returns VALIDATION_ERROR when AI apply PATCH has no Idempotency-Key', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Проверка idempotency',
      priority: 'medium',
      status: 'todo',
    });
    const createdTask = createRes.body as { id: string };

    const res = await request(server)
      .patch(`/api/v1/tasks/${createdTask.id}`)
      .send({
        priority: 'high',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          field: 'Idempotency-Key',
        },
      },
    });
  });

  it('generates decomposition suggestion without mutating DB', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Сложная задача для декомпозиции',
      priority: 'high',
      status: 'in_progress',
      description: 'Нужно разбить на шаги',
    });
    const createdTask = createRes.body as { id: string };

    const suggestionRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/ai/decompose`)
      .send({
        maxSubtasks: 6,
        language: 'ru',
      });

    expect(suggestionRes.status).toBe(200);
    const body = suggestionRes.body as {
      suggestion?: {
        subtasks?: Array<{ title?: unknown; description?: unknown }>;
        reason?: unknown;
      };
      meta?: { scenario?: string };
    };
    expect(Array.isArray(body.suggestion?.subtasks)).toBe(true);
    expect((body.suggestion?.subtasks?.length ?? 0) >= 1).toBe(true);
    expect((body.suggestion?.subtasks?.length ?? 0) <= 10).toBe(true);
    expect(typeof body.suggestion?.reason).toBe('string');
    expect(body.meta?.scenario).toBe('US-4');

    const childrenCount = await prisma.task.count({
      where: { parentTaskId: createdTask.id },
    });
    expect(childrenCount).toBe(0);
  });

  it('applies subtasks in one bulk call with idempotency replay', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Родитель для bulk apply',
      priority: 'high',
      status: 'todo',
    });
    const createdTask = createRes.body as { id: string };
    const idempotencyKey = `bulk-${createdTask.id}`;
    const payload = {
      subtasks: [
        { title: 'Шаг 1', description: 'Описание шага 1' },
        { title: 'Шаг 2', description: 'Описание шага 2' },
      ],
    };

    const firstApplyRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/subtasks/bulk`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(firstApplyRes.status).toBe(201);
    expect(firstApplyRes.body).toMatchObject({
      created: 2,
      parentTaskId: createdTask.id,
    });

    const replayRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/subtasks/bulk`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(replayRes.status).toBe(201);
    expect(replayRes.body).toMatchObject({
      created: 2,
      parentTaskId: createdTask.id,
    });

    const children = await prisma.task.findMany({
      where: { parentTaskId: createdTask.id },
      orderBy: { title: 'asc' },
    });
    expect(children).toHaveLength(2);
    expect(children.map((task) => task.title)).toEqual(['Шаг 1', 'Шаг 2']);
  });

  it('returns IDEMPOTENCY_CONFLICT when same key is reused with different payload', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Конфликт idempotency',
      priority: 'medium',
      status: 'todo',
    });
    const createdTask = createRes.body as { id: string };
    const idempotencyKey = `bulk-conflict-${createdTask.id}`;

    await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/subtasks/bulk`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        subtasks: [{ title: 'Первый шаг', description: 'A' }],
      })
      .expect(201);

    const conflictRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/subtasks/bulk`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        subtasks: [{ title: 'Другой шаг', description: 'B' }],
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body).toMatchObject({
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
      },
    });
  });

  it('returns deterministic workload summary with numeric consistency', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString();
    const inFiveDays = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();

    await request(server).post('/api/v1/tasks').send({
      title: 'Просроченная todo',
      priority: 'high',
      status: 'todo',
      dueDate: twoDaysAgo,
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Ближайшая in progress',
      priority: 'medium',
      status: 'in_progress',
      dueDate: tomorrow,
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Done в прошлом',
      priority: 'low',
      status: 'done',
      dueDate: twoDaysAgo,
    });
    await request(server).post('/api/v1/tasks').send({
      title: 'Будущая после окна',
      priority: 'high',
      status: 'todo',
      dueDate: inFiveDays,
    });

    const summaryRes = await request(server).get(
      '/api/v1/ai/workload-summary?upcomingDays=3',
    );

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body).toMatchObject({
      overdueCount: 1,
      upcomingCount: 1,
      distribution: {
        status: {
          todo: 2,
          in_progress: 1,
          done: 1,
        },
        priority: {
          low: 1,
          medium: 1,
          high: 2,
        },
      },
      meta: {
        scenario: 'US-6',
      },
    });
    const body = summaryRes.body as {
      summary?: unknown;
      focus?: unknown;
      meta?: { requestId?: unknown };
    };
    expect(typeof body.summary).toBe('string');
    expect(String(body.summary)).toContain('1 просроченные');
    expect(String(body.summary)).toContain('1 задачи на ближайшие 3');
    expect(Array.isArray(body.focus)).toBe(true);
    expect(typeof body.meta?.requestId).toBe('string');
  });
});

async function clearTasks(prisma: PrismaService): Promise<void> {
  await prisma.task.deleteMany({
    where: { parentTaskId: { not: null } },
  });
  await prisma.task.deleteMany({
    where: { parentTaskId: null },
  });
}
