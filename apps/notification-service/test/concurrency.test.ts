import { randomUUID } from 'node:crypto';
import { createPostgresTestDatabase } from '@market/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { Dispatcher } from '../src/delivery/dispatcher.js';
import type { OutgoingEmail } from '../src/delivery/provider.js';
import { NewsletterService } from '../src/newsletter/newsletter.service.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { TestEmailProvider, testConfig } from './harness.js';

/** Row-lock behaviour on real PostgreSQL. Needs TEST_DATABASE_URL (CI provides one). */
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('concurrency on real PostgreSQL', () => {
  let db: Database;
  let close: () => Promise<void>;
  const config = testConfig({ DISPATCH_BATCH_SIZE: '5' });

  beforeAll(async () => {
    ({ db, close } = await createPostgresTestDatabase({
      adminUrl: adminUrl!,
      schema,
      migrationsFolder: MIGRATIONS_FOLDER,
      maxConnections: 30,
    }));
  });

  afterAll(async () => {
    await close();
  });

  it('four dispatcher replicas send every queued email exactly once', async () => {
    const notifications = new NotificationService(db, config);
    const recipients = Array.from(
      { length: 40 },
      (_, i) => `r${String(i)}-${randomUUID()}@example.com`,
    );
    for (const email of recipients) {
      await notifications.enqueue(db, {
        key: randomUUID(),
        template: 'NEWSLETTER_CONFIRM',
        recipient: { userId: null, email },
        data: { link: 'https://shop.test/newsletter/confirm?token=t' },
      });
    }
    // A slow provider keeps each batch's row locks held while the others run.
    const sent: OutgoingEmail[] = [];
    const slow = new TestEmailProvider();
    const provider = {
      name: 'slow',
      send: async (email: OutgoingEmail) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        sent.push(email);
        return slow.send(email);
      },
    };
    const replicas = Array.from({ length: 4 }, () => new Dispatcher(config, db, provider));
    for (let round = 0; round < 4; round++) {
      await Promise.all(replicas.map((replica) => replica.dispatch()));
    }
    expect(sent.map((email) => email.to).sort()).toEqual([...recipients].sort());
  });

  it('20 simultaneous sign-ups for one address send one confirmation', async () => {
    const notifications = new NotificationService(db, config);
    const newsletter = new NewsletterService(db, config, notifications);
    const email = `race-${randomUUID()}@example.com`;
    await Promise.all(Array.from({ length: 20 }, () => newsletter.subscribe(email, 'test')));
    const provider = new TestEmailProvider();
    await new Dispatcher(config, db, provider).dispatch();
    expect(provider.to(email)).toHaveLength(1);
  });
});
