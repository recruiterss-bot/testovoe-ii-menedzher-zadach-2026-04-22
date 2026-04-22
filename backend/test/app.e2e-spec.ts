import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { createTestApp } from './create-test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
  });

  it('/api/v1/health (GET)', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    return request(server)
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body as { status: string; service: string }).toEqual(
          expect.objectContaining({
            status: 'ok',
            service: 'backend',
          }),
        );
      });
  });

  it('returns unified error envelope for missing route', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    return request(server)
      .get('/api/v1/not-existing-endpoint')
      .expect(404)
      .expect((res) => {
        const body = res.body as {
          error?: {
            code?: string;
            message?: string;
            details?: { requestId?: unknown };
          };
        };

        expect(body).toMatchObject({
          error: {
            code: 'NOT_FOUND',
            message: 'Cannot GET /api/v1/not-existing-endpoint',
          },
        });
        expect(typeof body.error?.details?.requestId).toBe('string');
      });
  });

  it('US-3 flow: suggest then apply classification', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Собрать демо',
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
    expect(suggestionRes.status).toBe(200);

    const suggestionBody = suggestionRes.body as {
      suggestion: { kind: 'category' | 'tag'; value: string };
    };
    const applyRes = await request(server)
      .patch(`/api/v1/tasks/${createdTask.id}`)
      .set('Idempotency-Key', `e2e-us3-${createdTask.id}`)
      .send({
        classificationKind: suggestionBody.suggestion.kind,
        classificationValue: suggestionBody.suggestion.value,
      });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body).toMatchObject({
      classificationKind: suggestionBody.suggestion.kind,
      classificationValue: suggestionBody.suggestion.value,
    });
  });

  it('US-5 flow: suggest then apply priority', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Проверить контракт',
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

    const suggestionBody = suggestionRes.body as {
      suggestion: { suggestedPriority: 'low' | 'medium' | 'high' };
    };
    const applyRes = await request(server)
      .patch(`/api/v1/tasks/${createdTask.id}`)
      .set('Idempotency-Key', `e2e-us5-${createdTask.id}`)
      .send({
        priority: suggestionBody.suggestion.suggestedPriority,
      });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body).toMatchObject({
      priority: suggestionBody.suggestion.suggestedPriority,
    });
  });

  it('US-4 flow: generate decomposition then apply subtasks', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const createRes = await request(server).post('/api/v1/tasks').send({
      title: 'Подготовить запуск',
      priority: 'high',
      status: 'todo',
    });
    const createdTask = createRes.body as { id: string };

    const decomposeRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/ai/decompose`)
      .send({
        maxSubtasks: 4,
        language: 'ru',
      });

    expect(decomposeRes.status).toBe(200);
    const decomposeBody = decomposeRes.body as {
      suggestion: {
        subtasks: Array<{ title: string; description: string | null }>;
      };
    };
    expect(decomposeBody.suggestion.subtasks.length).toBeGreaterThan(0);

    const applyPayload = {
      subtasks: decomposeBody.suggestion.subtasks.slice(0, 2),
    };
    const applyRes = await request(server)
      .post(`/api/v1/tasks/${createdTask.id}/subtasks/bulk`)
      .set('Idempotency-Key', `e2e-us4-${createdTask.id}`)
      .send(applyPayload);

    expect(applyRes.status).toBe(201);
    expect(applyRes.body).toMatchObject({
      parentTaskId: createdTask.id,
      created: applyPayload.subtasks.length,
    });
  });

  it('US-6 flow: get workload summary', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await request(server).post('/api/v1/tasks').send({
      title: 'Собрать обратную связь',
      priority: 'medium',
      status: 'todo',
      dueDate: tomorrow,
    });

    const summaryRes = await request(server).get(
      '/api/v1/ai/workload-summary?upcomingDays=3',
    );
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body).toMatchObject({
      meta: { scenario: 'US-6' },
    });
  });

  afterEach(async () => {
    await prisma.task.deleteMany({
      where: { parentTaskId: { not: null } },
    });
    await prisma.task.deleteMany({
      where: { parentTaskId: null },
    });
    await prisma.$disconnect();
    await app.close();
  });
});
