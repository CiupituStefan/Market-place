import { fileURLToPath } from 'node:url';
import type { Database as GenericDatabase } from '@market/db';
import * as schema from './schema.js';

export { schema };
export type Database = GenericDatabase<typeof schema>;

export const DATABASE = Symbol('DATABASE');

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
