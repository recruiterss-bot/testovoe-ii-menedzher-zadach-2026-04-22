import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpErrorEnvelopeFilter } from './common/filters/http-error-envelope.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
  });
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

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();
