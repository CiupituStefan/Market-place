import { ProductCreatedV1, ProductUpdatedV1 } from '@market/events';
import { outboxEvents } from '@market/db';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness.js';

let h: Harness;
let staff: string;
let admin: string;
let customer: string;

beforeAll(async () => {
  h = await createHarness();
  [staff, admin, customer] = await Promise.all([
    h.token(['USER', 'STAFF']),
    h.token(['USER', 'STAFF', 'ADMIN']),
    h.token(['USER']),
  ]);
});

afterAll(async () => {
  await h.close();
});

const preview = {
  kind: 'keyboard',
  layout: '65%',
  caseColor: '#222222',
  keyColor: '#eeeeee',
  accentColor: '#cc7733',
  legendColor: '#333333',
};

function newProduct(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    name: 'Test Board 65',
    brand: 'CSE',
    categorySlug: 'keyboards',
    kind: 'keyboard',
    tagline: 'A board for tests',
    preview,
    options: [
      {
        key: 'color',
        name: 'Color',
        display: 'swatch',
        values: [
          { value: 'black', label: 'Black', swatch: '#111111' },
          { value: 'white', label: 'White', swatch: '#fafafa' },
        ],
      },
    ],
    attributes: { layout: ['65%'], switchType: ['Linear'] },
    variants: [
      { sku: `${slug.toUpperCase()}-BLK`, options: { color: 'black' }, price: 15900 },
      {
        sku: `${slug.toUpperCase()}-WHT`,
        options: { color: 'white' },
        price: 14900,
        compareAtPrice: 16900,
      },
    ],
    ...overrides,
  };
}

async function create(slug: string, overrides: Record<string, unknown> = {}) {
  const res = await request(h.http)
    .post('/api/v1/products')
    .set('cookie', `cse_at=${staff}`)
    .send(newProduct(slug, overrides))
    .expect(201);
  return res.body.id as string;
}

async function events(type: string) {
  const rows = await h.db.select().from(outboxEvents);
  return rows
    .map((r) => r.envelope as { eventType: string; aggregateId: string; payload: unknown })
    .filter((e) => e.eventType === type);
}

describe('authorization', () => {
  it('rejects anonymous and customer writes', async () => {
    await request(h.http).post('/api/v1/products').send(newProduct('nope')).expect(401);
    await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${customer}`)
      .send(newProduct('nope'))
      .expect(403);
    await request(h.http)
      .get('/api/v1/products/manage')
      .set('cookie', `cse_at=${customer}`)
      .expect(403);
  });
});

describe('product lifecycle', () => {
  it('creates a draft that the store cannot see until it is published', async () => {
    const id = await create('test-board-65');
    await request(h.http).get('/api/v1/products/test-board-65').expect(404);
    const manage = await request(h.http)
      .get(`/api/v1/products/manage/${id}`)
      .set('cookie', `cse_at=${staff}`)
      .expect(200);
    expect(manage.body).toMatchObject({
      status: 'DRAFT',
      price: { amount: 14900 },
      compareAtPrice: { amount: 16900 },
    });

    await request(h.http)
      .post(`/api/v1/products/${id}/publish`)
      .set('cookie', `cse_at=${staff}`)
      .expect(204);
    const live = await request(h.http).get('/api/v1/products/test-board-65').expect(200);
    expect(live.body.attributes).toMatchObject({ brand: ['CSE'], layout: ['65%'] });
    expect((await request(h.http).get('/api/v1/products?q=test%20board')).body.items[0].slug).toBe(
      'test-board-65',
    );
  });

  it('records ProductCreated / ProductUpdated events in the outbox, valid against the contracts', async () => {
    const id = await create('event-board');
    await request(h.http)
      .post(`/api/v1/products/${id}/publish`)
      .set('cookie', `cse_at=${staff}`)
      .expect(204);
    const created = (await events('ProductCreated')).find((e) => e.aggregateId === id)!;
    expect(ProductCreatedV1.payload.parse(created.payload)).toMatchObject({
      slug: 'event-board',
      status: 'DRAFT',
    });
    const updated = (await events('ProductUpdated')).filter((e) => e.aggregateId === id).at(-1)!;
    expect(ProductUpdatedV1.payload.parse(updated.payload)).toMatchObject({
      status: 'PUBLISHED',
      changedFields: ['status'],
    });
  });

  it('validates variants against options with precise details', async () => {
    const res = await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${staff}`)
      .send(
        newProduct('bad-board', {
          variants: [{ sku: 'BAD-1', options: { color: 'purple' }, price: 100 }],
        }),
      )
      .expect(400);
    expect(res.body.error.details).toContainEqual({
      path: 'variants.0.options.color',
      message: 'Unknown value "purple"',
    });
  });

  it('rejects unknown fields, bad slugs and prices from the client', async () => {
    await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${staff}`)
      .send(newProduct('Bad Slug'))
      .expect(400);
    await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${staff}`)
      .send(newProduct('manage'))
      .expect(400);
    await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${staff}`)
      .send({ ...newProduct('x-board'), ratingAverage: 5 })
      .expect(400);
    await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${staff}`)
      .send(
        newProduct('y-board', {
          variants: [{ sku: 'Y-1', options: { color: 'black' }, price: 99.5 }],
        }),
      )
      .expect(400);
  });

  it('answers 409 for duplicate slugs and SKUs', async () => {
    await create('dupe-board');
    const slug = await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${staff}`)
      .send(newProduct('dupe-board'))
      .expect(409);
    expect(slug.body.error.message).toMatch(/slug/);
    const sku = await request(h.http)
      .post('/api/v1/products')
      .set('cookie', `cse_at=${staff}`)
      .send(
        newProduct('other-board', {
          variants: [
            { sku: 'DUPE-BOARD-BLK', options: { color: 'black' }, price: 100 },
            { sku: 'OTHER-W', options: { color: 'white' }, price: 100 },
          ],
        }),
      )
      .expect(409);
    expect(sku.body.error.message).toMatch(/SKU/);
  });

  it('re-prices: the listing "from" price follows variant changes', async () => {
    const id = await create('price-board');
    await request(h.http)
      .post(`/api/v1/products/${id}/publish`)
      .set('cookie', `cse_at=${staff}`)
      .expect(204);
    const product = await request(h.http)
      .get(`/api/v1/products/manage/${id}`)
      .set('cookie', `cse_at=${staff}`);
    const white = product.body.variants.find((v: { sku: string }) => v.sku === 'PRICE-BOARD-WHT');
    await request(h.http)
      .patch(`/api/v1/products/${id}/variants/${white.id}`)
      .set('cookie', `cse_at=${staff}`)
      .send({ price: 12900, compareAtPrice: null })
      .expect(204);
    const res = await request(h.http).get('/api/v1/products?q=price%20board').expect(200);
    expect(res.body.items[0]).toMatchObject({ price: { amount: 12900 }, compareAtPrice: null });
    await request(h.http)
      .patch(`/api/v1/products/${id}/variants/${white.id}`)
      .set('cookie', `cse_at=${staff}`)
      .send({ compareAtPrice: 12000 })
      .expect(400);
  });

  it('updates attributes and searchable text', async () => {
    const id = await create('rename-board');
    await request(h.http)
      .post(`/api/v1/products/${id}/publish`)
      .set('cookie', `cse_at=${staff}`)
      .expect(204);
    await request(h.http)
      .patch(`/api/v1/products/${id}`)
      .set('cookie', `cse_at=${staff}`)
      .send({ name: 'Zephyr Board', attributes: { layout: ['TKL'] } })
      .expect(204);
    expect((await request(h.http).get('/api/v1/products?q=zephyr')).body.items[0].slug).toBe(
      'rename-board',
    );
    const tkl = await request(h.http).get('/api/v1/products?layout=TKL').expect(200);
    expect(tkl.body.items.map((p: { slug: string }) => p.slug)).toContain('rename-board');
  });

  it('PATCH changes only the fields it receives', async () => {
    const id = await create('patch-board', { description: ['Keep me'], highlights: ['Also me'] });
    await request(h.http)
      .patch(`/api/v1/products/${id}`)
      .set('cookie', `cse_at=${staff}`)
      .send({ tagline: 'New tagline' })
      .expect(204);
    const res = await request(h.http)
      .get(`/api/v1/products/manage/${id}`)
      .set('cookie', `cse_at=${staff}`)
      .expect(200);
    expect(res.body).toMatchObject({
      tagline: 'New tagline',
      description: ['Keep me'],
      highlights: ['Also me'],
    });
    expect(res.body.options).toHaveLength(1);
    expect(res.body.attributes.layout).toEqual(['65%']);
  });

  it('manages variants, keeping options consistent', async () => {
    const id = await create('variant-board');
    await request(h.http)
      .post(`/api/v1/products/${id}/variants`)
      .set('cookie', `cse_at=${staff}`)
      .send({ sku: 'VARIANT-BOARD-BLK2', options: { color: 'black' }, price: 100 })
      .expect(400);
    await request(h.http)
      .patch(`/api/v1/products/${id}`)
      .set('cookie', `cse_at=${staff}`)
      .send({
        options: [
          {
            key: 'color',
            name: 'Color',
            display: 'swatch',
            values: [{ value: 'black', label: 'Black' }],
          },
        ],
      })
      .expect(400);
  });

  it('unpublishes and archives (archive is ADMIN only and final)', async () => {
    const id = await create('archive-board');
    await request(h.http)
      .post(`/api/v1/products/${id}/publish`)
      .set('cookie', `cse_at=${staff}`)
      .expect(204);
    await request(h.http)
      .post(`/api/v1/products/${id}/unpublish`)
      .set('cookie', `cse_at=${staff}`)
      .expect(204);
    await request(h.http).get('/api/v1/products/archive-board').expect(404);
    await request(h.http)
      .delete(`/api/v1/products/${id}`)
      .set('cookie', `cse_at=${staff}`)
      .expect(403);
    await request(h.http)
      .delete(`/api/v1/products/${id}`)
      .set('cookie', `cse_at=${admin}`)
      .expect(204);
    await request(h.http)
      .patch(`/api/v1/products/${id}`)
      .set('cookie', `cse_at=${staff}`)
      .send({ name: 'Back' })
      .expect(409);
  });

  it('lists products in every status for the back office', async () => {
    const res = await request(h.http)
      .get('/api/v1/products/manage?status=DRAFT')
      .set('cookie', `cse_at=${staff}`)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((p: { status: string }) => p.status === 'DRAFT')).toBe(true);
  });
});

describe('images', () => {
  it('issues a product-scoped upload form and registers the uploaded file', async () => {
    const id = await create('image-board');
    const upload = await request(h.http)
      .post(`/api/v1/products/${id}/images/upload-url`)
      .set('cookie', `cse_at=${staff}`)
      .send({ contentType: 'image/webp' })
      .expect(201);
    expect(upload.body.key).toMatch(new RegExp(`^products/${id}/[0-9a-f-]{36}\\.webp$`));

    const body = { key: upload.body.key, alt: 'Front view', width: 1600, height: 1200 };
    await request(h.http)
      .post(`/api/v1/products/${id}/images`)
      .set('cookie', `cse_at=${staff}`)
      .send(body)
      .expect(409);
    h.storage.uploaded.add(upload.body.key);
    const registered = await request(h.http)
      .post(`/api/v1/products/${id}/images`)
      .set('cookie', `cse_at=${staff}`)
      .send(body)
      .expect(201);

    const product = await request(h.http)
      .get(`/api/v1/products/manage/${id}`)
      .set('cookie', `cse_at=${staff}`);
    expect(product.body.images[0]).toEqual({
      url: `https://cdn.csekeyboards.test/${upload.body.key}`,
      alt: 'Front view',
      width: 1600,
      height: 1200,
    });
    await request(h.http)
      .delete(`/api/v1/products/${id}/images/${registered.body.id}`)
      .set('cookie', `cse_at=${staff}`)
      .expect(204);
    expect(h.storage.deleted).toContain(upload.body.key);
  });

  it('refuses keys that belong elsewhere and unsupported types', async () => {
    const id = await create('image-board-2');
    await request(h.http)
      .post(`/api/v1/products/${id}/images`)
      .set('cookie', `cse_at=${staff}`)
      .send({ key: 'products/someone-else/x.webp', alt: 'x', width: 1, height: 1 })
      .expect(400);
    await request(h.http)
      .post(`/api/v1/products/${id}/images/upload-url`)
      .set('cookie', `cse_at=${staff}`)
      .send({ contentType: 'image/svg+xml' })
      .expect(400);
  });
});

describe('categories', () => {
  it('creates categories under a parent and rejects duplicates', async () => {
    const body = {
      slug: 'artisan-keycaps',
      name: 'Artisan keycaps',
      parentSlug: 'keycaps',
      preview,
    };
    await request(h.http)
      .post('/api/v1/categories')
      .set('cookie', `cse_at=${staff}`)
      .send(body)
      .expect(201);
    await request(h.http)
      .post('/api/v1/categories')
      .set('cookie', `cse_at=${staff}`)
      .send(body)
      .expect(409);
    const res = await request(h.http).get('/api/v1/categories/artisan-keycaps').expect(200);
    expect(res.body.parentSlug).toBe('keycaps');
  });
});
