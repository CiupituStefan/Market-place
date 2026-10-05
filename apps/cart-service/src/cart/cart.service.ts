import { createHash, randomBytes } from 'node:crypto';
import {
  DomainError,
  ErrorCode,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  money,
  type Cart,
  type CartItem,
  type CartNotice,
  type ConfigurationSelection,
} from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import {
  CATALOG,
  INVENTORY,
  type CatalogGateway,
  type InventoryGateway,
  type VariantLookup,
} from '../clients/clients.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import {
  cartItems,
  carts,
  discountCodes,
  discountRedemptions,
  type CartItemRow,
  type CartRow,
} from '../db/schema.js';
import { evaluateCoupon, normalizeCode } from '../discounts/discount-rules.js';
import { priceCart } from '../pricing/pricing.js';

export interface CartIdentity {
  userId: string | null;
  guestToken: string | null;
}

/** What the controller must do with the visitor cookie after an operation. */
export interface CookieInstruction {
  setGuestToken?: string;
  clearGuestToken?: boolean;
}

/** Removes every line and the coupon. Idempotent; takes the caller's transaction. */
export async function emptyCart(db: Database, cartId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await db
    .update(carts)
    .set({ couponCode: null, updatedAt: new Date() })
    .where(eq(carts.id, cartId));
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function quantityError(): DomainError {
  return new DomainError(
    ErrorCode.VALIDATION_FAILED,
    `Quantity must be between 1 and ${MAX_LINE_QUANTITY}`,
    [{ path: 'quantity', message: `1–${MAX_LINE_QUANTITY}` }],
  );
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CATALOG) private readonly catalog: CatalogGateway,
    @Inject(INVENTORY) private readonly inventory: InventoryGateway,
  ) {}

  // ── queries ────────────────────────────────────────────────────────────────

  async view(identity: CartIdentity): Promise<{ cart: Cart; cookie: CookieInstruction }> {
    const { cart, cookie } = await this.resolve(identity, false);
    return { cart: cart ? await this.price(cart) : this.emptyCart(), cookie };
  }

  // ── commands ───────────────────────────────────────────────────────────────

  async addVariant(identity: CartIdentity, variantId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY)
      throw quantityError();
    const [variant] = await this.catalog.lookupVariants([variantId]);
    if (variant?.productStatus !== 'PUBLISHED') {
      throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'This product is not available');
    }
    const { cart, cookie } = await this.resolve(identity, true);
    if (!cart) throw new Error('cart was not created');

    const [existing] = await this.db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
    const desired = (existing?.quantity ?? 0) + quantity;
    if (desired > MAX_LINE_QUANTITY) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `You can add at most ${MAX_LINE_QUANTITY} of one item`,
      );
    }
    await this.assertStock(variant, desired);
    if (!existing) await this.assertRoom(cart.id);

    await this.db
      .insert(cartItems)
      .values({
        cartId: cart.id,
        kind: 'variant',
        variantId,
        quantity,
        unitPriceSnapshot: variant.price.amount,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.variantId],
        set: {
          // Atomic: concurrent adds of the same item cannot lose an increment.
          quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, ${MAX_LINE_QUANTITY})`,
          unitPriceSnapshot: variant.price.amount,
          updatedAt: new Date(),
        },
      });
    await this.touch(cart.id);
    return { cart: await this.price(cart), cookie };
  }

  async addConfiguration(
    identity: CartIdentity,
    configurator: string,
    selection: ConfigurationSelection,
    quantity: number,
  ) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY)
      throw quantityError();
    // The quote validates the combination and prices it on the server.
    const quote = await this.catalog.quote(configurator, selection);
    const { cart, cookie } = await this.resolve(identity, true);
    if (!cart) throw new Error('cart was not created');
    const [existing] = await this.db
      .select()
      .from(cartItems)
      .where(
        and(eq(cartItems.cartId, cart.id), eq(cartItems.configurationId, quote.configurationId)),
      );
    if ((existing?.quantity ?? 0) + quantity > MAX_LINE_QUANTITY) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `You can add at most ${MAX_LINE_QUANTITY} of one item`,
      );
    }
    if (!existing) await this.assertRoom(cart.id);
    await this.db
      .insert(cartItems)
      .values({
        cartId: cart.id,
        kind: 'configuration',
        configurator,
        configurationId: quote.configurationId,
        selection: quote.selection,
        quantity,
        unitPriceSnapshot: quote.price.amount,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.configurationId],
        set: {
          quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, ${MAX_LINE_QUANTITY})`,
          unitPriceSnapshot: quote.price.amount,
          updatedAt: new Date(),
        },
      });
    await this.touch(cart.id);
    return { cart: await this.price(cart), cookie };
  }

  async updateQuantity(identity: CartIdentity, itemId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY)
      throw quantityError();
    const { cart, cookie } = await this.requireCart(identity);
    const item = await this.requireItem(cart.id, itemId);
    if (item.kind === 'variant' && item.variantId && quantity > item.quantity) {
      const [variant] = await this.catalog.lookupVariants([item.variantId]);
      if (variant) await this.assertStock(variant, quantity);
    }
    await this.db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, itemId));
    await this.touch(cart.id);
    return { cart: await this.price(cart), cookie };
  }

  async removeItem(identity: CartIdentity, itemId: string) {
    const { cart, cookie } = await this.requireCart(identity);
    await this.requireItem(cart.id, itemId);
    await this.db.delete(cartItems).where(eq(cartItems.id, itemId));
    await this.touch(cart.id);
    return { cart: await this.price(cart), cookie };
  }

  async applyCoupon(identity: CartIdentity, rawCode: string) {
    const { cart, cookie } = await this.requireCart(identity);
    const code = normalizeCode(rawCode);
    const [row] = await this.db.select().from(discountCodes).where(eq(discountCodes.code, code));
    if (!row) throw new DomainError(ErrorCode.COUPON_INVALID, 'This code is not valid');
    const priced = await this.price({ ...cart, couponCode: null });
    const verdict = evaluateCoupon(row, {
      subtotal: priced.subtotal.amount,
      now: new Date(),
      userId: cart.userId,
      customerUses: await this.customerUses(row.id, cart.userId),
    });
    if (!verdict.ok) throw new DomainError(ErrorCode[verdict.reason], verdict.message);
    await this.db
      .update(carts)
      .set({ couponCode: code, updatedAt: new Date() })
      .where(eq(carts.id, cart.id));
    return { cart: await this.price({ ...cart, couponCode: code }), cookie };
  }

  async removeCoupon(identity: CartIdentity) {
    const { cart, cookie } = await this.requireCart(identity);
    await this.db
      .update(carts)
      .set({ couponCode: null, updatedAt: new Date() })
      .where(eq(carts.id, cart.id));
    return { cart: await this.price({ ...cart, couponCode: null }), cookie };
  }

  async empty(identity: CartIdentity) {
    const { cart, cookie } = await this.resolve(identity, false);
    if (!cart) return { cart: this.emptyCart(), cookie };
    await this.clear(cart.id);
    return { cart: await this.price({ ...cart, couponCode: null }), cookie };
  }

  async clear(cartId: string): Promise<void> {
    await this.db.transaction((tx) => emptyCart(tx, cartId));
  }

  /** For order-service: the authoritative priced cart of a shopper. */
  async pricedFor(identity: CartIdentity): Promise<Cart> {
    const { cart } = await this.resolve(identity, false);
    return cart ? this.price(cart) : this.emptyCart();
  }

  // ── identity ───────────────────────────────────────────────────────────────

  /**
   * Finds (optionally creates) the shopper's cart. When a signed-in user still has
   * a visitor cart cookie, the visitor cart is merged into the user's and removed.
   */
  private async resolve(
    identity: CartIdentity,
    create: boolean,
  ): Promise<{ cart: CartRow | null; cookie: CookieInstruction }> {
    const guestHash = identity.guestToken ? hashToken(identity.guestToken) : null;
    const [guestCart] = guestHash
      ? await this.db.select().from(carts).where(eq(carts.guestTokenHash, guestHash))
      : [];

    if (identity.userId) {
      let [userCart] = await this.db.select().from(carts).where(eq(carts.userId, identity.userId));
      if (!userCart && (create || guestCart)) {
        [userCart] = await this.db
          .insert(carts)
          .values({ userId: identity.userId, currency: this.config.CURRENCY })
          .onConflictDoNothing()
          .returning();
        userCart ??= (
          await this.db.select().from(carts).where(eq(carts.userId, identity.userId))
        )[0];
      }
      if (guestCart?.userId === null && userCart) await this.merge(guestCart, userCart);
      return {
        cart: userCart ?? null,
        cookie: identity.guestToken ? { clearGuestToken: true } : {},
      };
    }

    if (guestCart) return { cart: guestCart, cookie: {} };
    if (!create)
      return { cart: null, cookie: identity.guestToken ? { clearGuestToken: true } : {} };
    const token = randomBytes(32).toString('base64url');
    const [created] = await this.db
      .insert(carts)
      .values({ guestTokenHash: hashToken(token), currency: this.config.CURRENCY })
      .returning();
    return { cart: created ?? null, cookie: { setGuestToken: token } };
  }

  /** Moves visitor lines into the user's cart (quantities add up, capped) and deletes the visitor cart. */
  private async merge(guest: CartRow, user: CartRow): Promise<void> {
    await this.db.transaction(async (tx) => {
      const lines = await tx.select().from(cartItems).where(eq(cartItems.cartId, guest.id));
      for (const line of lines) {
        const target =
          line.kind === 'variant'
            ? [cartItems.cartId, cartItems.variantId]
            : [cartItems.cartId, cartItems.configurationId];
        await tx
          .insert(cartItems)
          .values({ ...line, id: undefined, cartId: user.id })
          .onConflictDoUpdate({
            target,
            set: {
              quantity: sql`LEAST(${cartItems.quantity} + ${line.quantity}, ${MAX_LINE_QUANTITY})`,
              updatedAt: new Date(),
            },
          });
      }
      if (!user.couponCode && guest.couponCode) {
        await tx.update(carts).set({ couponCode: guest.couponCode }).where(eq(carts.id, user.id));
        user.couponCode = guest.couponCode;
      }
      await tx.delete(carts).where(eq(carts.id, guest.id));
    });
    this.logger.log(`merged visitor cart ${guest.id} into user cart ${user.id}`);
  }

  private async requireCart(
    identity: CartIdentity,
  ): Promise<{ cart: CartRow; cookie: CookieInstruction }> {
    const { cart, cookie } = await this.resolve(identity, false);
    if (!cart) throw new DomainError(ErrorCode.CART_NOT_FOUND, 'Your cart is empty');
    return { cart, cookie };
  }

  private async requireItem(cartId: string, itemId: string): Promise<CartItemRow> {
    const [item] = await this.db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
    if (!item) throw new DomainError(ErrorCode.NOT_FOUND, 'This item is not in your cart');
    return item;
  }

  private async assertRoom(cartId: string): Promise<void> {
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(cartItems)
      .where(eq(cartItems.cartId, cartId));
    if (total >= MAX_CART_LINES) throw new DomainError(ErrorCode.CONFLICT, 'Your cart is full');
  }

  /** Best-effort stock check: if inventory is unreachable, checkout's reservation is the real gate. */
  private async assertStock(variant: VariantLookup, quantity: number): Promise<void> {
    let available: number | undefined;
    try {
      available = (await this.inventory.available([variant.variantId])).get(variant.variantId) ?? 0;
    } catch {
      this.logger.warn('inventory unavailable: accepting the line, checkout will verify stock');
      return;
    }
    if (available < quantity) {
      throw new DomainError(
        ErrorCode.INSUFFICIENT_STOCK,
        available === 0 ? 'This item is out of stock' : `Only ${available} left in stock`,
        [
          {
            path: variant.sku,
            message: available === 0 ? 'Out of stock' : `Only ${available} left`,
          },
        ],
      );
    }
  }

  private async customerUses(discountCodeId: string, userId: string | null): Promise<number> {
    if (!userId) return 0;
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(discountRedemptions)
      .where(
        and(
          eq(discountRedemptions.discountCodeId, discountCodeId),
          eq(discountRedemptions.userId, userId),
        ),
      );
    return total;
  }

  private async touch(cartId: string): Promise<void> {
    await this.db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  }

  // ── pricing ────────────────────────────────────────────────────────────────

  private emptyCart(): Cart {
    const currency = this.config.CURRENCY;
    const zero = money(0, currency);
    return {
      id: null,
      items: [],
      itemCount: 0,
      couponCode: null,
      notices: [],
      subtotal: zero,
      discount: zero,
      shipping: zero,
      tax: zero,
      total: zero,
      freeShippingThreshold: money(this.config.FREE_SHIPPING_THRESHOLD, currency),
      canCheckout: false,
    };
  }

  /**
   * Re-prices every line from the catalog, checks stock, re-validates the coupon
   * and computes totals. Records the price the shopper is now seeing so a later
   * change can be flagged once.
   */
  private async price(cart: CartRow): Promise<Cart> {
    const currency = this.config.CURRENCY;
    const rows = await this.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(asc(cartItems.createdAt));
    const variantIds = rows.flatMap((row) =>
      row.kind === 'variant' && row.variantId ? [row.variantId] : [],
    );
    const [lookups, stock] = await Promise.all([
      this.catalog.lookupVariants(variantIds),
      this.inventory.available(variantIds).catch(() => null),
    ]);
    const byId = new Map(lookups.map((lookup) => [lookup.variantId, lookup]));
    const notices: CartNotice[] = [];
    const items: CartItem[] = [];

    for (const row of rows) {
      const item =
        row.kind === 'variant'
          ? this.variantLine(row, byId.get(row.variantId ?? ''), stock)
          : await this.configurationLine(row);
      if (item.unitPrice.amount !== row.unitPriceSnapshot && item.available) {
        notices.push({
          code: 'PRICE_CHANGED',
          message: `The price of ${item.name} changed since you added it`,
          itemId: row.id,
        });
        await this.db
          .update(cartItems)
          .set({ unitPriceSnapshot: item.unitPrice.amount })
          .where(eq(cartItems.id, row.id));
      }
      if (!item.available) {
        // Listed but short on stock, as opposed to gone from the catalog.
        const outOfStock =
          row.kind === 'variant' &&
          item.availableQuantity !== null &&
          byId.get(row.variantId ?? '')?.productStatus === 'PUBLISHED';
        notices.push({
          code: outOfStock ? 'INSUFFICIENT_STOCK' : 'ITEM_UNAVAILABLE',
          message: outOfStock
            ? item.availableQuantity === 0
              ? `${item.name} is out of stock`
              : `Only ${String(item.availableQuantity)} of ${item.name} left`
            : `${item.name} is no longer available`,
          itemId: row.id,
        });
      }
      items.push(item);
    }

    const sellable = items.filter((item) => item.available);
    const subtotalOfSellable = sellable.reduce((sum, item) => sum + item.lineTotal.amount, 0);
    let couponCode = cart.couponCode;
    let discount: { type: 'PERCENTAGE' | 'FIXED'; value: number } | null = null;
    if (couponCode) {
      const [code] = await this.db
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.code, couponCode));
      const verdict = code
        ? evaluateCoupon(code, {
            subtotal: subtotalOfSellable,
            now: new Date(),
            userId: cart.userId,
            customerUses: await this.customerUses(code.id, cart.userId),
          })
        : ({
            ok: false,
            reason: 'COUPON_INVALID',
            message: 'This code is no longer valid',
          } as const);
      if (code && verdict.ok) {
        discount = { type: code.type, value: code.value };
      } else {
        notices.push({
          code: 'COUPON_REMOVED',
          message: verdict.ok ? '' : `${couponCode}: ${verdict.message}`,
          itemId: null,
        });
        await this.db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
        couponCode = null;
      }
    }

    const totals = priceCart(
      sellable.map((item) => ({ unitPrice: item.unitPrice.amount, quantity: item.quantity })),
      discount,
      {
        currency,
        vatRateBps: this.config.VAT_RATE_BPS,
        freeShippingThreshold: this.config.FREE_SHIPPING_THRESHOLD,
        shippingFlatRate: this.config.SHIPPING_FLAT_RATE,
      },
    );
    return {
      id: cart.id,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      couponCode,
      notices,
      ...totals,
      freeShippingThreshold: money(this.config.FREE_SHIPPING_THRESHOLD, currency),
      canCheckout: items.length > 0 && items.every((item) => item.available),
    };
  }

  private variantLine(
    row: CartItemRow,
    lookup: VariantLookup | undefined,
    stock: Map<string, number> | null,
  ): CartItem {
    const currency = this.config.CURRENCY;
    const availableQuantity = stock ? (stock.get(row.variantId ?? '') ?? 0) : null;
    const listed = lookup?.productStatus === 'PUBLISHED';
    const unitPrice = lookup ? lookup.price : money(row.unitPriceSnapshot, currency);
    return {
      id: row.id,
      kind: 'variant',
      variantId: row.variantId,
      configurationId: null,
      configurator: null,
      selection: null,
      sku: lookup?.sku ?? '',
      productSlug: lookup?.productSlug ?? null,
      name: lookup?.productName ?? 'Unavailable product',
      optionsLabel: lookup?.optionsLabel ?? '',
      quantity: row.quantity,
      unitPrice,
      lineTotal: money(unitPrice.amount * row.quantity, unitPrice.currency),
      preview: lookup?.preview ?? {
        kind: 'keyboard',
        caseColor: '#888888',
        keyColor: '#bbbbbb',
        accentColor: '#999999',
        legendColor: '#555555',
      },
      imageUrl: lookup?.imageUrl ?? null,
      available: listed && (availableQuantity === null || availableQuantity >= row.quantity),
      availableQuantity,
    };
  }

  private async configurationLine(row: CartItemRow): Promise<CartItem> {
    const selection = row.selection ?? {};
    const configurator = row.configurator ?? '';
    let quote: Awaited<ReturnType<CatalogGateway['quote']>> | null = null;
    try {
      quote = await this.catalog.quote(configurator, selection);
    } catch (error) {
      // A configuration that became invalid (option discontinued) stays visible but unavailable.
      if (!(error instanceof DomainError) || error.status >= 500) throw error;
    }
    const definition = await this.catalog.configurator(configurator).catch(() => null);
    const labels = definition
      ? definition.groups.flatMap((group) =>
          group.options.filter((o) => o.value === selection[group.key]).map((o) => o.label),
        )
      : Object.values(selection);
    const unitPrice = quote?.price ?? money(row.unitPriceSnapshot, this.config.CURRENCY);
    return {
      id: row.id,
      kind: 'configuration',
      variantId: null,
      configurationId: row.configurationId,
      configurator,
      selection,
      sku: quote?.sku ?? '',
      productSlug: null,
      name: definition?.name ?? 'Custom keyboard',
      optionsLabel: labels.join(' / '),
      quantity: row.quantity,
      unitPrice,
      lineTotal: money(unitPrice.amount * row.quantity, unitPrice.currency),
      preview: quote?.preview ?? {
        kind: 'keyboard',
        caseColor: '#2a2c31',
        keyColor: '#3b3e45',
        accentColor: '#c8743f',
        legendColor: '#d9d4ca',
      },
      imageUrl: null,
      // Built to order: availability is the configuration being valid.
      available: quote !== null,
      availableQuantity: null,
    };
  }
}
