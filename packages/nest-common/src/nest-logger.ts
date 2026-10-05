import type { Logger } from '@market/logger';
import type { LoggerService } from '@nestjs/common';

/**
 * Routes Nest's internal logs (bootstrap, route mapping, lifecycle) through the
 * structured pino logger so every line in production is JSON.
 */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...context: unknown[]): void {
    this.logger.info(this.fields(context), String(message));
  }

  error(message: unknown, ...context: unknown[]): void {
    this.logger.error(this.fields(context), String(message));
  }

  warn(message: unknown, ...context: unknown[]): void {
    this.logger.warn(this.fields(context), String(message));
  }

  debug(message: unknown, ...context: unknown[]): void {
    this.logger.debug(this.fields(context), String(message));
  }

  verbose(message: unknown, ...context: unknown[]): void {
    this.logger.trace(this.fields(context), String(message));
  }

  fatal(message: unknown, ...context: unknown[]): void {
    this.logger.fatal(this.fields(context), String(message));
  }

  private fields(context: unknown[]): Record<string, unknown> {
    // Nest passes the context name last, and a stack trace before it for errors.
    const strings = context.filter((c): c is string => typeof c === 'string');
    const name = strings.at(-1);
    const stack = strings.length > 1 ? strings[0] : undefined;
    return { ...(name ? { context: name } : {}), ...(stack ? { stack } : {}) };
  }
}
