import { baseServiceEnv, loadEnv, SERVICES } from '@market/config';
import { z } from 'zod';

export const SERVICE_NAME = 'cart-service';

// Service-specific variables (database, Kafka, ...) are added here as the service grows.
export const ConfigSchema = baseServiceEnv.extend({
  PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
});
export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}
