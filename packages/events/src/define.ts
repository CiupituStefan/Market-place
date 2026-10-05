import { type z } from 'zod';
import type { Topic } from './topics.js';

export interface EventDefinition<
  TType extends string = string,
  TVersion extends number = number,
  TPayload extends z.ZodType = z.ZodType,
> {
  readonly type: TType;
  readonly version: TVersion;
  readonly topic: Topic;
  readonly payload: TPayload;
}

export function defineEvent<
  const TType extends string,
  const TVersion extends number,
  TPayload extends z.ZodType,
>(
  definition: EventDefinition<TType, TVersion, TPayload>,
): EventDefinition<TType, TVersion, TPayload> {
  return Object.freeze(definition);
}

export type PayloadOf<D extends EventDefinition> = z.infer<D['payload']>;
