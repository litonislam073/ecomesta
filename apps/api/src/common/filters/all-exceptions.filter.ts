import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: unknown;

    if (status < 500) {
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = HttpStatus[status] ?? code;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const payload = exceptionResponse as Record<string, unknown>;
        if (typeof payload.message === 'string') {
          message = payload.message;
        } else if (Array.isArray(payload.message)) {
          message = 'Validation failed';
          details = payload.message;
        }
        if (typeof payload.error === 'string') {
          code = payload.error.toUpperCase().replace(/\s+/g, '_');
        } else {
          code = HttpStatus[status] ?? code;
        }
      }
    } else {
      // Never leak exception.message (or HttpException 500 payloads) to clients.
      message = 'Internal server error';
      code = 'INTERNAL_SERVER_ERROR';
      this.logger.error(
        {
          path: request.url,
          method: request.method,
          status,
          err: exception,
        },
        'Unhandled exception',
      );
    }

    const body: ErrorBody = {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    };

    response.status(status).json(body);
  }
}
