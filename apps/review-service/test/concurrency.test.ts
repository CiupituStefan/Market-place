import { randomUUID } from 'node:crypto';
import { createPostgresTestDatabase } from '@market/db/testing';
import type { AuthUser } from '@market/types';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { reviews } from '../src/db/schema.js';
import { ReviewService } from '../src/reviews/review.service.js';
import { FakeCatalog, testConfig } from './harness.js';

/** Counter and uniqueness races on real row locks. Needs TEST_DATABASE_URL (CI provides one). */
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('concurrency on real PostgreSQL', () => {
  let db: Database;
  let close: () => Promise<void>;
  let service: ReviewService;
  const catalog = new FakeCatalog();
  const user = (): AuthUser => ({
    id: randomUUID(),
    sessionId: randomUUID(),
    roles: ['USER'],
    emailVerified: true,
  });
  const input = {
    rating: 5,
    title: 'Great',
    body: 'A very good keyboard, would buy again.',
    authorName: 'Ana',
  };

  beforeAll(async () => {
    ({ db, close } = await createPostgresTestDatabase({
      adminUrl: adminUrl!,
      schema,
      migrationsFolder: MIGRATIONS_FOLDER,
      maxConnections: 30,
    }));
    service = new ReviewService(db, testConfig(), catalog);
  });

  afterAll(async () => {
    await close();
  });

  it('keeps vote counters exact under 25 simultaneous voters', async () => {
    const { productId } = catalog.addProduct();
    const review = await service.create(user(), productId, input);
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        service.vote(randomUUID(), review.id, i % 5 === 0 ? 'not_helpful' : 'helpful'),
      ),
    );
    const [row] = await db.select().from(reviews).where(eq(reviews.id, review.id));
    expect(row).toMatchObject({ helpfulCount: 20, notHelpfulCount: 5 });
  });

  it('stores one review when the same shopper submits five times at once', async () => {
    const { productId } = catalog.addProduct();
    const me = user();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.create(me, productId, input)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.select().from(reviews).where(eq(reviews.productId, productId))).toHaveLength(1);
  });
});
