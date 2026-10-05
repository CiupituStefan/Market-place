import { DomainError, ErrorCode } from '@market/types';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/**
 * Validates and transforms input with a Zod schema. Invalid input becomes a
 * VALIDATION_FAILED error with field-level details (never echoing values).
 *
 * Usage: `@Body(new ZodValidationPipe(CreateProductSchema)) body: CreateProduct`
 */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new DomainError(
      ErrorCode.VALIDATION_FAILED,
      'Request validation failed',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
}

/**
 * JSON Schema for a Zod schema, for use in `@ApiBody({ schema })` /
 * `@ApiResponse({ schema })`. One schema drives validation and documentation.
 */
export function openApiSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    unrepresentable: 'any',
  });
  return jsonSchema;
}
