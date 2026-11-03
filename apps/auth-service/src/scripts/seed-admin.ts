import { createLogger } from '@market/logger';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { normalizeEmail, PASSWORD_MIN } from '../auth/dto.js';
import { hashPassword } from '../auth/password.js';
import { SecretBox, base32Decode } from '../mfa/totp.js';
import { loadConfig } from '../config.js';
import { connectPostgres } from '@market/db';
import { schema } from '../db/database.js';
import { users } from '../db/schema.js';

/**
 * Creates the first ADMIN account (or promotes an existing user). Credentials come
 * from the environment, never from code:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @market/auth-service seed:admin
 *
 * The admin acts as ADMIN only after two-step sign-in (TOTP); a real admin turns it on in the
 * account page. ADMIN_TOTP_SECRET (base32) enrols a known authenticator instead: for local
 * development and the end-to-end tests only, never for a public deployment. An admin whose
 * two-step sign-in is already on is left as is.
 */
const logger = createLogger({ service: 'auth-service-seed' });
const Input = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(PASSWORD_MIN),
  ADMIN_FIRST_NAME: z.string().default('Store'),
  ADMIN_LAST_NAME: z.string().default('Admin'),
  ADMIN_TOTP_SECRET: z
    .string()
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .refine((value) => value === undefined || base32Decode(value).length >= 10, {
      message: 'must be base32, at least 80 bits',
    }),
});

try {
  const config = loadConfig();
  const input = Input.parse(process.env);
  const postgres = connectPostgres({
    url: config.DATABASE_URL,
    schema,
    applicationName: 'auth-service-seed',
    maxConnections: 1,
  });
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
    if (input.ADMIN_TOTP_SECRET) {
      const enrolled = await postgres.db
        .update(users)
        .set({
          totpSecret: new SecretBox(config.MFA_ENCRYPTION_KEY).seal(input.ADMIN_TOTP_SECRET),
          totpEnabledAt: new Date(),
          totpLastStep: null,
        })
        .where(and(eq(users.email, email), isNull(users.totpEnabledAt)))
        .returning({ id: users.id });
      if (enrolled.length > 0) logger.warn({ email }, 'admin enrolled with ADMIN_TOTP_SECRET');
    }
    logger.info({ email }, 'admin account ready');
  } finally {
    await postgres.close();
  }
} catch (error) {
  logger.fatal({ err: error }, 'seeding admin failed');
  process.exitCode = 1;
}
