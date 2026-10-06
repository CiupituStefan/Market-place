import { randomUUID } from 'node:crypto';
import { expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { env } from './env.js';

export interface Money {
  amount: number;
  currency: string;
}

export interface CartView {
  items: { id: string; variantId: string; quantity: number }[];
  total: Money;
}

export interface ApiResult<T> {
  status: number;
  body: T;
}

/**
 * The public API as one client sees it: its own cookie jar (session or visitor cart), the
 * storefront's Origin (cookie-authenticated writes are CSRF-checked), JSON in and out.
 * For arranging what the browser journeys need, and for the checks a browser cannot race.
 */
export class ShopApi {
  private constructor(readonly context: APIRequestContext) {}

  static async create(): Promise<ShopApi> {
    return new ShopApi(
      await playwrightRequest.newContext({
        baseURL: `${env.apiUrl}/api/v1/`,
        extraHTTPHeaders: { origin: env.webUrl, accept: 'application/json' },
      }),
    );
  }

  /** Signed in as the seeded administrator. */
  static async admin(): Promise<ShopApi> {
    const api = await ShopApi.create();
    await api.ok('POST', 'auth/login', { email: env.adminEmail, password: env.adminPassword });
    return api;
  }

  async call<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    data?: unknown,
    headers: Record<string, string> = {},
  ): Promise<ApiResult<T>> {
    const response = await this.context.fetch(path, {
      method,
      ...(data === undefined ? {} : { data }),
      headers,
    });
    const text = await response.text();
    return { status: response.status(), body: (text ? JSON.parse(text) : null) as T };
  }

  /** `call`, failing the test with the error body unless the status is 2xx. */
  async ok<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    data?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const result = await this.call<T>(method, path, data, headers);
    expect(result.status, `${method} ${path}: ${JSON.stringify(result.body)}`).toBeLessThan(300);
    return result.body;
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }

  // ── storefront ──────────────────────────────────────────────────────────────

  addToCart(variantId: string, quantity = 1): Promise<CartView> {
    return this.ok<CartView>('POST', 'cart/items', { variantId, quantity });
  }

  placeOrder(email: string, expectedTotal: number) {
    return this.call<{ error?: { code: string } }>(
      'POST',
      'orders',
      { email, shippingAddress: address(), expectedTotal },
      { 'idempotency-key': randomUUID() },
    );
  }

  // ── back office (admin session) ─────────────────────────────────────────────

  /**
   * A published product of its own with one variant and `stock` units in stock, so a test can
   * reason about exact quantities whatever else runs against the same shop.
   */
  async createStockedProduct(
    stock: number,
    price = 4_900,
  ): Promise<{ slug: string; variantId: string }> {
    const id = randomUUID().slice(0, 8);
    const slug = `e2e-cable-${id}`;
    const preview = {
      kind: 'cable',
      caseColor: '#1f2937',
      keyColor: '#f59e0b',
      accentColor: '#10b981',
      legendColor: '#ffffff',
    };
    const { id: productId } = await this.ok<{ id: string }>('POST', 'products', {
      slug,
      name: `E2E coiled cable ${id}`,
      brand: 'CSE',
      categorySlug: 'cables',
      kind: 'cable',
      preview,
      variants: [{ sku: `E2E-CABLE-${id.toUpperCase()}`, options: {}, price }],
    });
    await this.ok('POST', `products/${productId}/publish`);
    const product = await this.ok<{ variants: { id: string }[] }>(
      'GET',
      `products/manage/${productId}`,
    );
    const variantId = product.variants[0]?.id ?? '';
    // inventory-service learns about the variant from the catalog's Kafka event.
    await expect
      .poll(async () => (await this.call('GET', `inventory/${variantId}`)).status, {
        timeout: 30_000,
        message: 'inventory knows the new variant',
      })
      .toBe(200);
    await this.ok('POST', `inventory/${variantId}/adjustments`, {
      type: 'RECEIVED',
      delta: stock,
      reason: 'E2E test stock',
    });
    return { slug, variantId };
  }

  stockOf(variantId: string) {
    return this.ok<{ onHand: number; reserved: number; available: number }>(
      'GET',
      `inventory/${variantId}`,
    );
  }
}

let counter = 0;

/** A fresh, recognisable address per call: tests never share accounts or mailboxes. */
export function uniqueEmail(label: string): string {
  counter += 1;
  return `e2e-${label}-${Date.now().toString(36)}-${String(counter)}-${randomUUID().slice(0, 6)}@example.test`;
}

export function address() {
  return {
    firstName: 'Ana',
    lastName: 'Popescu',
    line1: 'Strada Memorandumului 28',
    city: 'Cluj-Napoca',
    postalCode: '400114',
    country: 'RO',
  };
}
