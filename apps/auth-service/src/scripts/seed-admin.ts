import { createLogger } from '@market/logger';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { normalizeEmail, PASSWORD_MIN } from '../auth/dto.js';
import { hashPassword } from '../auth/password.js';
import { loadConfig } from '../config.js';
import { connectPostgres } from '../db/database.js';
import { users } from '../db/schema.js';

/**
 * Creates the first ADMIN account (or promotes an existing user). Credentials come
 * from the environment, never from code:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @market/auth-service seed:admin
 */
const logger = createLogger({ service: 'auth-service-seed' });
const Input = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(PASSWORD_MIN),
  ADMIN_FIRST_NAME: z.string().default('Store'),
  ADMIN_LAST_NAME: z.string().default('Admin'),
});

try {
  const config = loadConfig();
  const input = Input.parse(process.env);
  const postgres = connectPostgres(config.DATABASE_URL, 1);
  try {
    const email = normalizeEmail(input.ADMIN_EMAIL);
    await postgres.db
      .insert(users)
      .values({
        email,
        passwordHash: await hashPassword(input.ADMIN_PASSWORD),
        firstName: input.ADMIN_FIRST_NAME,
        lastName: input.ADMIN_LAST_NAME,
        roles: ['USER', 'STAFF', 'ADMIN'],
        emailVerifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { roles: sql`ARRAY['USER','STAFF','ADMIN']::text[]`, updatedAt: new Date() },
      });
    logger.info({ email }, 'admin account ready');
  } finally {
    await postgres.close();
  }
} catch (error) {
  logger.fatal({ err: error }, 'seeding admin failed');
  process.exitCode = 1;
}
