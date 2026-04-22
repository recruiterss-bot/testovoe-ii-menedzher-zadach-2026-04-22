import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { HttpErrorEnvelopeFilter } from '../src/common/filters/http-error-envelope.filter';
import { RequestLoggingInterceptor } from '../src/common/interceptors/request-logging.interceptor';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpErrorEnvelopeFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const fields = errors.map((error) => ({
          field: error.property,
          constraints: error.constraints ?? {},
        }));

        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: { fields },
        });
      },
    }),
  );

  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}
