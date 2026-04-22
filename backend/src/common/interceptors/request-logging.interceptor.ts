import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestWithId } from '../types/request-with-id.type';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLogger');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<RequestWithId>();
    const res = httpContext.getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              requestId: req.requestId,
              method: req.method,
              path: req.originalUrl || req.url,
              statusCode: res.statusCode,
              latencyMs: Date.now() - startTime,
            }),
          );
        },
        error: () => {
          this.logger.warn(
            JSON.stringify({
              requestId: req.requestId,
              method: req.method,
              path: req.originalUrl || req.url,
              statusCode: res.statusCode,
              latencyMs: Date.now() - startTime,
            }),
          );
        },
      }),
    );
  }
}
