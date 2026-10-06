import { recordError } from '@market/telemetry';
import { getRequestContext, type Logger } from '@market/logger';
import {
  ApiErrorBodySchema,
  DomainError,
  ErrorCode,
  toApiErrorBody,
  type ApiErrorBody,
} from '@market/types';
import { HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestId } from './request-context.js';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  429: ErrorCode.RATE_LIMITED,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  504: ErrorCode.UPSTREAM_TIMEOUT,
};

export function errorCodeForStatus(status: number): ErrorCode {
  return (
    STATUS_CODES[status] ?? (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_FAILED)
  );
}

interface Normalised {
  status: number;
  body: ApiErrorBody;
}

/**
 * Converts every thrown value into the standard error body:
 * `{ error: { code, message, requestId, details? } }`.
 * Stack traces and internal messages are logged, never returned.
 */
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = getRequestContext()?.requestId ?? getRequestId(req);

    const { status, body } = this.normalise(exception, requestId);

    if (status >= 500) {
      this.logger.error({ err: exception, request_id: requestId, status }, 'unhandled error');
      recordError(exception);
    }
    if (res.headersSent) {
      // Response already streaming (e.g. proxied body): the only option is to abort it.
      res.destroy();
      return;
    }
    res.status(status).json(body);
  }

  private normalise(exception: unknown, requestId: string): Normalised {
    if (exception instanceof DomainError) {
      return {
        status: exception.status,
        body: toApiErrorBody(exception.code, exception.message, requestId, exception.details),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      // Already in the standard format (e.g. thrown with an ApiErrorBody payload).
      const parsed = ApiErrorBodySchema.safeParse(response);
      if (parsed.success) {
        return { status, body: { error: { ...parsed.data.error, requestId } } };
      }
      // Nest's router 404 ("Cannot GET /x") is replaced by a uniform message.
      const message =
        status >= 500
          ? 'Internal server error'
          : status === 404 && exception.message.startsWith('Cannot ')
            ? 'Route not found'
            : exception.message;
      return { status, body: toApiErrorBody(errorCodeForStatus(status), message, requestId) };
    }

    // Body-parser and other Express errors carry an HTTP status.
    if (isHttpLikeError(exception)) {
      const status = exception.status;
      const message = status >= 500 ? 'Internal server error' : exception.message;
      return { status, body: toApiErrorBody(errorCodeForStatus(status), message, requestId) };
    }

    return {
      status: 500,
      body: toApiErrorBody(ErrorCode.INTERNAL_ERROR, 'Internal server error', requestId),
    };
  }
}

function isHttpLikeError(value: unknown): value is Error & { status: number } {
  return (
    value instanceof Error &&
    'status' in value &&
    typeof value.status === 'number' &&
    value.status >= 400 &&
    value.status < 600 &&
    'expose' in value
  );
}
