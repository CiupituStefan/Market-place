import { createHash, randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { createTestDatabase } from '@market/db/testing';
import { createLogger } from '@market/logger';
import { configureApp, JwtVerifier } from '@market/nest-common';
import {
  DomainError,
  ErrorCode,
  JWT_AUDIENCE,
  money,
  type ConfigurationQuote,
  type ConfigurationSelection,
  type Configurator,
  type Role,
} from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import type { CatalogGateway, InventoryGateway, VariantLookup } from '../src/clients/clients.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';

export function testConfig(): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/cart',
  });
}

const preview = {
  kind: 'keyboard',
  caseColor: '#202020',
  keyColor: '#303030',
  accentColor: '#c06030',
  legendColor: '#e0e0e0',
} as const;

/** In-memory product-service: tests change prices and statuses directly. */
export class FakeCatalog implements CatalogGateway {
  readonly variants = new Map<string, VariantLookup>();
  /** Configuration options that are discontinued (quote fails with 422). */
  readonly discontinued = new Set<string>();
  calls = 0;

  addVariant(price: number, overrides: Partial<VariantLookup> = {}): VariantLookup {
    const variantId = randomUUID();
    const variant: VariantLookup = {
      variantId,
      productId: randomUUID(),
      productSlug: `board-${variantId.slice(0, 6)}`,
      productName: `Board ${variantId.slice(0, 6)}`,
      sku: `SKU-${variantId.slice(0, 8).toUpperCase()}`,
      optionsLabel: 'Tactile / Black',
      price: money(price, 'EUR'),
      compareAtPrice: null,
      availability: 'IN_STOCK',
      productStatus: 'PUBLISHED',
      preview,
      imageUrl: null,
      ...overrides,
    };
    this.variants.set(variantId, variant);
    return variant;
  }

  setPrice(variantId: string, amount: number): void {
    const variant = this.variants.get(variantId);
    if (variant) this.variants.set(variantId, { ...variant, price: money(amount, 'EUR') });
  }

  lookupVariants(variantIds: string[]): Promise<VariantLookup[]> {
    this.calls += 1;
    return Promise.resolve(variantIds.flatMap((id) => this.variants.get(id) ?? []));
  }

  quote(configurator: string, selection: ConfigurationSelection): Promise<ConfigurationQuote> {
    if (configurator !== 'custom-75') {
      return Promise.reject(new DomainError(ErrorCode.NOT_FOUND, 'Unknown configurator'));
    }
    if (!selection.layout || !selection.switch) {
      return Promise.reject(
        new DomainError(ErrorCode.VALIDATION_FAILED, 'Choose a layout and switches'),
      );
    }
    if (Object.values(selection).some((value) => this.discontinued.has(value))) {
      return Promise.reject(new DomainError(ErrorCode.VALIDATION_FAILED, 'Option unavailable'));
    }
    const key = `${selection.layout}|${selection.switch}`;
    const price = 150_00 + (selection.switch === 'linear-pro' ? 20_00 : 0);
    return Promise.resolve({
      configurationId: `cfg_${createHash('sha256').update(key).digest('hex').slice(0, 20)}`,
      sku: `CFG-${selection.layout}-${selection.switch}`.toUpperCase(),
      selection: { layout: selection.layout, switch: selection.switch },
      price: money(price, 'EUR'),
      breakdown: [{ group: null, label: 'Base', amount: money(price, 'EUR') }],
      preview,
    });
  }

  configurator(slug: string): Promise<Configurator> {
    const eur = (amount: number) => money(amount, 'EUR');
    return Promise.resolve({
      slug,
      name: 'Custom 75%',
      description: 'Build your own',
      basePrice: eur(150_00),
      groups: [
        {
          key: 'layout',
          label: 'Layout',
          options: [
            {
              value: 'ansi',
              label: 'ANSI',
              description: null,
              priceDelta: eur(0),
              available: true,
              swatch: null,
            },
          ],
        },
        {
          key: 'switch',
          label: 'Switches',
          options: [
            {
              value: 'linear-pro',
              label: 'Linear Pro',
              description: null,
              priceDelta: eur(20_00),
              available: true,
              swatch: null,
            },
            {
              value: 'tactile',
              label: 'Tactile',
              description: null,
              priceDelta: eur(0),
              available: true,
              swatch: null,
            },
          ],
        },
      ],
      incompatibilities: [],
      defaultSelection: {},
    });
  }
}

/** In-memory inventory-service; `down` simulates an outage. */
export class FakeInventory implements InventoryGateway {
  readonly stock = new Map<string, number>();
  down = false;

  available(variantIds: string[]): Promise<Map<string, number>> {
    if (this.down) {
      return Promise.reject(
        new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'inventory-service is unavailable'),
      );
    }
    return Promise.resolve(new Map(variantIds.map((id) => [id, this.stock.get(id) ?? 0])));
  }
}

export interface Harness {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  catalog: FakeCatalog;
  inventory: FakeInventory;
  /** Signs an access token for the given user. */
  token: (userId: string, roles?: Role[]) => Promise<string>;
  close: () => Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const config = testConfig();
  const { db, close } = await createTestDatabase({ schema, migrationsFolder: MIGRATIONS_FOLDER });
  const keys = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'EdDSA' };
  const verifier = new JwtVerifier(createLocalJWKSet({ keys: [jwk] }), {
    issuer: config.JWT_ISSUER,
  });
  const token = (userId: string, roles: Role[] = ['USER']) =>
    new SignJWT({ sid: randomUUID(), roles, email_verified: true })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setSubject(userId)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keys.privateKey);

  const catalog = new FakeCatalog();
  const inventory = new FakeInventory();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier, catalog, inventory })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, {
    logger: createLogger({
      service: 'cart-service',
      destination: new Writable({
        write: (_chunk, _encoding, callback) => {
          callback();
        },
      }),
    }),
  });
  await app.init();
  return {
    app,
    http: app.getHttpServer(),
    db,
    catalog,
    inventory,
    token,
    close: async () => {
      await app.close();
      await close();
    },
  };
}

/** Extracts `cse_cart=<token>` from a response, for sending back as a Cookie header. */
export function cartCookie(setCookie: string[] | string | undefined): string | undefined {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = values.find(
    (value) => value.startsWith('cse_cart=') && !value.startsWith('cse_cart=;'),
  );
  return found?.split(';')[0];
}
