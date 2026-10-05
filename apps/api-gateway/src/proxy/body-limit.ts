import { Transform, type TransformCallback } from 'node:stream';
import { DomainError, ErrorCode } from '@market/types';

export function payloadTooLarge(maxBytes: number): DomainError {
  return new DomainError(ErrorCode.PAYLOAD_TOO_LARGE, `Request body exceeds ${maxBytes} bytes`);
}

/**
 * Counts bytes as the body streams through and fails once the limit is crossed.
 * Needed for chunked uploads, where Content-Length cannot be checked up front.
 */
export class BodyLimit extends Transform {
  private received = 0;

  constructor(private readonly maxBytes: number) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.received += chunk.length;
    if (this.received > this.maxBytes) {
      callback(payloadTooLarge(this.maxBytes));
      return;
    }
    callback(null, chunk);
  }
}
