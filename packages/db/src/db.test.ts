import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotificationRequestedV1 } from '@market/events';
import { runWithContext } from '@market/logger';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { enqueueEvent, isUniqueViolation, outboxEvents, runMigrations } from './index.js';
import { createPostgresTestDatabase, createTestDatabase } from './testing.js';

/** Minimal drizzle migration folder creating just the outbox table. */
function migrationsWithOutbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  mkdirSync(join(dir, 'meta'));
  writeFileSync(
    join(dir, '0000_outbox.sql'),
    `CREATE TABLE "outbox_events" ("id" uuid PRIMARY KEY NOT NULL, "sequence" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "topic" text NOT NULL, "message_key" text NOT NULL, "envelope" jsonb NOT NULL, "headers" jsonb DEFAULT '{}'::jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "published_at" timestamp with time zone, "attempts" integer DEFAULT 0 NOT NULL);`,
  );
  writeFileSync(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [{ idx: 0, version: '7', when: 1, tag: '0000_outbox', breakpoints: true }],
    }),
  );
  return dir;
}

describe('outbox', () => {
  type TestDb = Awaited<
    ReturnType<typeof createTestDatabase<{ outboxEvents: typeof outboxEvents }>>
  >;
  let db: TestDb['db'];
  let close: TestDb['close'];

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase({
      schema: { outboxEvents },
      migrationsFolder: migrationsWithOutbox(),
    }));
  });

  afterEach(async () => {
    await close();
  });

  it('stores a validated envelope keyed by aggregate, with the request correlation id', async () => {
    const userId = '0b7c1f0e-4f2a-4d8e-9a43-3c1f6f1c9a10';
    const eventId = await runWithContext({ requestId: 'req-42' }, () =>
      enqueueEvent(
        db,
        NotificationRequestedV1,
        {
          notificationKey: 'k1',
          channel: 'EMAIL',
          template: 'ORDER_CONFIRMATION',
          recipient: { userId, email: 'a@b.co' },
          data: {},
        },
        { producer: 'test-service', aggregateId: userId },
      ),
    );
    const [row] = await db.select().from(outboxEvents);
    expect(row).toMatchObject({
      id: eventId,
      topic: 'notifications.requests',
      messageKey: userId,
      publishedAt: null,
      // No active trace here: nothing to carry (packages/messaging tests the traced case).
      headers: {},
    });
    expect(row!.envelope).toMatchObject({
      correlationId: 'req-42',
      producer: 'test-service',
      eventType: 'NotificationRequested',
    });
  });

  it('refuses invalid payloads before touching the database', async () => {
    await expect(
      enqueueEvent(db, NotificationRequestedV1, { notificationKey: '' } as never, {
        producer: 'x',
        aggregateId: 'y',
      }),
    ).rejects.toThrow();
    expect(await db.select().from(outboxEvents)).toHaveLength(0);
  });
});

describe('isUniqueViolation', () => {
  it('finds the code through wrapped causes', () => {
    expect(isUniqueViolation(new Error('wrapped', { cause: { code: '23505' } }))).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

/** Real PostgreSQL only (needs several connections). TEST_DATABASE_URL is set in CI. */
describe.skipIf(!process.env.TEST_DATABASE_URL)('runMigrations on PostgreSQL', () => {
  it('lets several replicas start at once: one applies, the others find it done', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'mig-empty-'));
    mkdirSync(join(empty, 'meta'));
    writeFileSync(
      join(empty, 'meta', '_journal.json'),
      JSON.stringify({ version: '7', dialect: 'postgresql', entries: [] }),
    );
    const target = await createPostgresTestDatabase({
      adminUrl: process.env.TEST_DATABASE_URL ?? '',
      schema: { outboxEvents },
      migrationsFolder: empty,
    });
    try {
      const folder = migrationsWithOutbox();
      await Promise.all(Array.from({ length: 6 }, () => runMigrations(target.url, folder)));
      const applied = await target.db.execute(
        sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
      );
      expect((applied as { rows: { n: number }[] }).rows[0]?.n).toBe(1);
    } finally {
      await target.close();
    }
  });
});
