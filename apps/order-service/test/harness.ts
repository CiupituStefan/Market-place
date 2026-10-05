import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { createTestDatabase } from '@market/db/testing';
import { createLogger } from '@market/logger';
import { configureApp, JwtVerifier } from '@market/nest-common';
import {
  DomainError,
  ErrorCode,
  JWT_AUDIENCE,
  money,
  type Cart,
  type CartItem,
  type Role,
} from '@market/types';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AppModule } from '../src/app.module.js';
import type {
  CartGateway,
  CartIdentity,
  InventoryGateway,
  Redemption,
  Reservation,
} from '../src/clients/clients.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/orders',
    SWEEPER_ENABLED: 'false',
    ...overrides,
  });
}

const preview = {
  kind: 'keyboard',
  caseColor: '#202020',
  keyColor: '#303030',
  accentColor: '#c06030',
  legendColor: '#e0e0e0',
} as const;

export function variantItem(
  price: number,
  quantity = 1,
  variantId: string = randomUUID(),
): CartItem {
  return {
    id: randomUUID(),
    kind: 'variant',
    variantId,
    configurationId: null,
    configurator: null,
    selection: null,
    sku: `SKU-${variantId.slice(0, 8).toUpperCase()}`,
    productSlug: 'cse-test-board',
    name: 'Test Board',
    optionsLabel: 'Black / Linear',
    quantity,
    unitPrice: money(price, 'EUR'),
    lineTotal: money(price * quantity, 'EUR'),
    preview,
    imageUrl: null,
    available: true,
    availableQuantity: 10,
  };
}

export function configurationItem(price: number): CartItem {
  return {
    ...variantItem(price),
    kind: 'configuration',
    variantId: null,
    configurationId: `cfg_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
    configurator: 'custom-75',
    selection: { layout: 'ansi', switch: 'linear' },
    productSlug: null,
    name: 'Custom 75%',
    availableQuantity: null,
  };
}

/** A priced cart as cart-service would return it (flat €6.90 shipping under €99, as there). */
export function cartOf(
  items: CartItem[],
  options: { discount?: number; couponCode?: string } = {},
): Cart {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal.amount, 0);
  const discount = options.discount ?? 0;
  const shipping = subtotal - discount >= 99_00 ? 0 : 6_90;
  const total = subtotal - discount + shipping;
  return {
    id: randomUUID(),
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    couponCode: options.couponCode ?? null,
    notices: [],
    subtotal: money(subtotal, 'EUR'),
    discount: money(discount, 'EUR'),
    shipping: money(shipping, 'EUR'),
    tax: money(Math.round((total * 2_100) / 12_100), 'EUR'),
    total: money(total, 'EUR'),
    freeShippingThreshold: money(99_00, 'EUR'),
    canCheckout: true,
  };
}

/** In-memory cart-service. */
export class FakeCart implements CartGateway {
  /** Keyed by user id or guest token. */
  readonly carts = new Map<string, Cart>();
  readonly cleared: string[] = [];
  readonly redemptions = new Map<string, string>();
  readonly released: string[] = [];
  redeemError: DomainError | null = null;
  down = false;

  set(identity: CartIdentity, cart: Cart): Cart {
    this.carts.set(identity.userId ?? identity.guestToken ?? '', cart);
    return cart;
  }

  priced(identity: CartIdentity): Promise<Cart> {
    if (this.down)
      return Promise.reject(
        new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'cart-service is unavailable'),
      );
    const cart = this.carts.get(identity.userId ?? identity.guestToken ?? '');
    return Promise.resolve(cart ?? { ...cartOf([]), id: null });
  }

  clear(cartId: string): Promise<void> {
    this.cleared.push(cartId);
    return Promise.resolve();
  }

  redeem(input: { code: string; orderId: string }): Promise<Redemption> {
    if (this.redeemError) return Promise.reject(this.redeemError);
    this.redemptions.set(input.orderId, input.code);
    return Promise.resolve({ orderId: input.orderId, code: input.code });
  }

  release(orderId: string): Promise<void> {
    this.redemptions.delete(orderId);
    this.released.push(orderId);
    return Promise.resolve();
  }
}

/** In-memory inventory-service with the same idempotency and late-confirmation rules. */
export class FakeInventory implements InventoryGateway {
  readonly stock = new Map<string, number>();
  readonly reservations = new Map<
    string,
    Reservation & { orderId: string; lines: { variantId: string; quantity: number }[] }
  >();

  reserve(
    orderId: string,
    lines: { variantId: string; quantity: number }[],
    ttlSeconds: number,
  ): Promise<Reservation> {
    const existing = [...this.reservations.values()].find((r) => r.orderId === orderId);
    if (existing) return Promise.resolve(existing);
    for (const line of lines) {
      const available = this.stock.get(line.variantId) ?? 0;
      if (available < line.quantity) {
        return Promise.reject(
          new DomainError(ErrorCode.INSUFFICIENT_STOCK, `Only ${String(available)} left`),
        );
      }
    }
    for (const line of lines)
      this.stock.set(line.variantId, (this.stock.get(line.variantId) ?? 0) - line.quantity);
    const reservation = {
      id: randomUUID(),
      orderId,
      lines,
      status: 'ACTIVE' as const,
      expiresAt: new Date(Date.now() + ttlSeconds * 1_000).toISOString(),
    };
    this.reservations.set(reservation.id, reservation);
    return Promise.resolve(reservation);
  }

  confirm(reservationId: string): Promise<Reservation> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) return Promise.reject(new DomainError(ErrorCode.NOT_FOUND, 'no reservation'));
    if (reservation.status === 'CONFIRMED') return Promise.resolve(reservation);
    if (reservation.status !== 'ACTIVE') {
      // Late confirmation: sell from what is still available, or fail.
      for (const line of reservation.lines) {
        if ((this.stock.get(line.variantId) ?? 0) < line.quantity) {
          return Promise.reject(new DomainError(ErrorCode.INSUFFICIENT_STOCK, 'sold out'));
        }
      }
      for (const line of reservation.lines)
        this.stock.set(line.variantId, (this.stock.get(line.variantId) ?? 0) - line.quantity);
    }
    reservation.status = 'CONFIRMED';
    return Promise.resolve(reservation);
  }

  release(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (reservation?.status === 'ACTIVE') {
      reservation.status = 'RELEASED';
      for (const line of reservation.lines)
        this.stock.set(line.variantId, (this.stock.get(line.variantId) ?? 0) + line.quantity);
    }
    if (reservation?.status === 'CONFIRMED') {
      return Promise.reject(new DomainError(ErrorCode.CONFLICT, 'already sold'));
    }
    return Promise.resolve();
  }

  /** Simulates inventory's own expiry sweeper. */
  expire(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (reservation?.status !== 'ACTIVE') return;
    reservation.status = 'EXPIRED';
    for (const line of reservation.lines)
      this.stock.set(line.variantId, (this.stock.get(line.variantId) ?? 0) + line.quantity);
  }

  forOrder(orderId: string) {
    return [...this.reservations.values()].find((r) => r.orderId === orderId);
  }
}

export interface Harness {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  db: Database;
  cart: FakeCart;
  inventory: FakeInventory;
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

  const cart = new FakeCart();
  const inventory = new FakeInventory();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, { db, verifier, cart, inventory })],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, {
    logger: createLogger({
      service: 'order-service',
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
    cart,
    inventory,
    token,
    close: async () => {
      await app.close();
      await close();
    },
  };
}

export const address = {
  firstName: 'Ana',
  lastName: 'Pop',
  line1: 'Strada Lalelelor 12',
  city: 'Cluj-Napoca',
  postalCode: '400001',
  country: 'RO',
} as const;
