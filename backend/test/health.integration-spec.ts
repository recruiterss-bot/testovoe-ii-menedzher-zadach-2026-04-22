import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { createTestApp } from './create-test-app';

describe('Health integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('returns x-request-id header', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(typeof res.headers['x-request-id']).toBe('string');
      });
  });
});
