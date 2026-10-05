import { z } from 'zod';

/** Parses "true"/"false"/"1"/"0" env strings. z.coerce.boolean() would treat "false" as true. */
export const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/** Comma separated list, e.g. KAFKA_BROKERS=kafka-1:9092,kafka-2:9092 */
export const commaList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().min(1)).min(1));

export const NodeEnvSchema = z.enum(['development', 'test', 'production']);
export type NodeEnv = z.infer<typeof NodeEnvSchema>;

export const LogLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);

/** Variables every service needs. */
export const baseServiceEnv = z.object({
  NODE_ENV: NodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535),
  LOG_LEVEL: LogLevelSchema.default('info'),
  /** Comma separated list of allowed browser origins; only used by edge-facing services. */
  CORS_ORIGINS: commaList.optional(),
});

export const postgresEnv = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

export const redisEnv = z.object({
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
});

export const kafkaEnv = z.object({
  KAFKA_BROKERS: commaList,
  KAFKA_CLIENT_ID: z.string().min(1),
  /** MSK in AWS uses TLS + IAM; local Kafka is plaintext. */
  KAFKA_SSL: booleanString.default(false),
});
