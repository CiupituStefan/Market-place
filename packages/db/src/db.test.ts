import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotificationRequestedV1 } from '@market/events';
import { runWithContext } from '@market/logger';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enqueueEvent, isUniqueViolation, outboxEvents } from './index.js';
import { createTestDatabase } from './testing.js';

/** Minimal drizzle migration folder creating just the outbox table. */
function migrationsWithOutbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  mkdirSync(join(dir, 'meta'));
  writeFileSync(
    join(dir, '0000_outbox.sql'),
    `CREATE TABLE "outbox_events" ("id" uuid PRIMARY KEY NOT NULL, "topic" text NOT NULL, "message_key" text NOT NULL, "envelope" jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "published_at" timestamp with time zone, "attempts" integer DEFAULT 0 NOT NULL);`,
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
