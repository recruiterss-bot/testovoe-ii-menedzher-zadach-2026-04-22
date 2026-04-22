import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { RequestWithId } from '../types/request-with-id.type';

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
};

@Catch()
export class HttpErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const details: Record<string, unknown> = {
      requestId: request.requestId ?? null,
    };

    let code = this.mapErrorCode(status);
    let message = this.defaultMessage(status);

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const payload = exceptionResponse as Record<string, unknown>;

      if (typeof payload.code === 'string') {
        code = payload.code;
      }
      if (typeof payload.message === 'string') {
        message = payload.message;
      }
      if (Array.isArray(payload.message)) {
        details.violations = payload.message;
      }
      if (
        payload.details &&
        typeof payload.details === 'object' &&
        !Array.isArray(payload.details)
      ) {
        Object.assign(details, payload.details as Record<string, unknown>);
      }
    }

    const body: ErrorEnvelope = {
      error: {
        code,
        message,
        details,
      },
    };

    response.status(status).json(body);
  }

  private mapErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 504:
        return 'AI_TIMEOUT';
      case 502:
        return 'AI_UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  private defaultMessage(status: number): string {
    switch (status) {
      case 400:
        return 'Invalid request';
      case 404:
        return 'Resource not found';
      case 409:
        return 'Conflict';
      case 504:
        return 'AI request timeout';
      case 502:
        return 'AI provider unavailable';
      default:
        return 'Internal server error';
    }
  }
}
