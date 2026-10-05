import { DomainError, ErrorCode, type Paginated } from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import {
  inventoryItems,
  stockMovements,
  type InventoryRow,
  type MovementRow,
} from '../db/schema.js';
import { applyStockChange } from './ledger.js';
import { availableOf, stockStatus, type StockStatus } from './levels.js';

export interface StockItemView {
  variantId: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  status: StockStatus;
  updatedAt: string;
}

export function toView(row: InventoryRow): StockItemView {
  const available = availableOf(row);
  return {
    variantId: row.variantId,
    sku: row.sku,
    onHand: row.onHand,
    reserved: row.reserved,
    available,
    lowStockThreshold: row.lowStockThreshold,
    status: stockStatus(available, row.lowStockThreshold),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class StockService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(query: {
    page: number;
    pageSize: number;
    q?: string | undefined;
    lowStock?: boolean;
  }): Promise<Paginated<StockItemView>> {
    const term = query.q ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
    const where = and(
      term ? ilike(inventoryItems.sku, term) : undefined,
      query.lowStock
        ? sql`${inventoryItems.onHand} - ${inventoryItems.reserved} <= ${inventoryItems.lowStockThreshold}`
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(inventoryItems)
        .where(where)
        .orderBy(
          asc(sql`${inventoryItems.onHand} - ${inventoryItems.reserved}`),
          asc(inventoryItems.sku),
        )
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ total: count() }).from(inventoryItems).where(where),
    ]);
    const total = totals[0]?.total ?? 0;
    return {
      items: rows.map(toView),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async get(variantId: string): Promise<StockItemView> {
    const [row] = await this.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.variantId, variantId));
    if (!row)
      throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'No stock record for this variant');
    return toView(row);
  }

  async movements(variantId: string, limit: number): Promise<MovementRow[]> {
    return this.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.variantId, variantId))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(limit);
  }

  /**
   * Manual change by staff: goods received (positive) or a correction after a
   * count (either sign). On-hand can never drop below what is currently reserved.
   */
  async adjust(
    variantId: string,
    input: { type: 'RECEIVED' | 'ADJUSTMENT'; delta: number; reason: string },
    actor: string,
  ): Promise<StockItemView> {
    if (input.type === 'RECEIVED' && input.delta <= 0) {
      throw new DomainError(ErrorCode.VALIDATION_FAILED, 'Received quantity must be positive', [
        { path: 'delta', message: 'Must be greater than 0' },
      ]);
    }
    return this.db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.variantId, variantId))
        .for('update');
      if (!item)
        throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'No stock record for this variant');
      if (item.onHand + input.delta < item.reserved) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `On-hand cannot drop below the ${item.reserved} unit(s) held for open checkouts`,
        );
      }
      return toView(
        await applyStockChange(tx, variantId, {
          type: input.type,
          onHandDelta: input.delta,
          reservedDelta: 0,
          actor,
          reason: input.reason,
        }),
      );
    });
  }

  async setThreshold(variantId: string, lowStockThreshold: number): Promise<StockItemView> {
    const [row] = await this.db
      .update(inventoryItems)
      .set({ lowStockThreshold, updatedAt: new Date() })
      .where(eq(inventoryItems.variantId, variantId))
      .returning();
    if (!row)
      throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'No stock record for this variant');
    return toView(row);
  }

  /** Current sellable quantities (cart validation). Unknown variants are simply absent. */
  async availability(variantIds: string[]): Promise<StockItemView[]> {
    const rows = await this.db
      .select()
      .from(inventoryItems)
      .where(inArray(inventoryItems.variantId, variantIds));
    return rows.map(toView);
  }

  /**
   * Ensures a stock record exists for each catalog variant (fed by ProductCreated /
   * ProductUpdated). New variants start at zero; SKU renames are applied.
   */
  async syncVariants(variants: { variantId: string; sku: string }[]): Promise<number> {
    if (variants.length === 0) return 0;
    const rows = await this.db
      .insert(inventoryItems)
      .values(
        variants.map((v) => ({ ...v, lowStockThreshold: this.config.DEFAULT_LOW_STOCK_THRESHOLD })),
      )
      .onConflictDoUpdate({
        target: inventoryItems.variantId,
        set: { sku: sql`excluded.sku`, updatedAt: new Date() },
      })
      .returning({ variantId: inventoryItems.variantId });
    return rows.length;
  }
}
