import { Writable } from 'node:stream';
import { createLogger, type Logger } from '@market/logger';

/** Logger that captures JSON lines in memory, for asserting on log output. */
export function memoryLogger(): { logger: Logger; lines: Record<string, unknown>[] } {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  return { logger: createLogger({ service: 'test', level: 'debug', destination }), lines };
}
