import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { getRequestContext } from './context.js';

export type { Logger } from 'pino';

/**
 * Paths whose values must never reach log storage. Card data is never handled by
 * our services (Stripe Payment Element), but is listed defensively.
 */
export const REDACTED_PATHS = [
  'password',
  '*.password',
  'newPassword',
  '*.newPassword',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'secret',
  '*.secret',
  'cardNumber',
  '*.cardNumber',
  'cvc',
  '*.cvc',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["stripe-signature"]',
  'res.headers["set-cookie"]',
];

export interface CreateLoggerOptions {
  service: string;
  level?: string;
  /** Human-readable output for local development. Never enable in production. */
  pretty?: boolean;
  /** Custom destination, mainly for tests. */
  destination?: DestinationStream;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const config: LoggerOptions = {
    level: options.level ?? 'info',
    base: { service: options.service },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
    formatters: {
      // Emit "level":"info" instead of numeric levels: easier to query in Loki/CloudWatch.
      level: (label) => ({ level: label }),
    },
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    mixin() {
      const context = getRequestContext();
      if (!context) return {};
      return context.userId
        ? { request_id: context.requestId, user_id: context.userId }
        : { request_id: context.requestId };
    },
  };

  if (options.destination) return pino(config, options.destination);
  if (options.pretty) {
    return pino({
      ...config,
      transport: { target: 'pino-pretty', options: { colorize: true, messageKey: 'message' } },
    });
  }
  return pino(config);
}
