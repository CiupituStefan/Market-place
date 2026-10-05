import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { productImages, products, productVariants } from '../db/schema.js';
import { OBJECT_STORAGE, type ObjectStorage, type PresignedUpload } from './object-storage.js';

export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const;

export const UploadRequestSchema = z
  .object({ contentType: z.enum(Object.keys(IMAGE_TYPES) as [keyof typeof IMAGE_TYPES]) })
  .strict();

export const RegisterImageSchema = z
  .object({
    key: z.string().min(1).max(300),
    alt: z.string().trim().min(1).max(200),
    width: z.int().min(1).max(10_000),
    height: z.int().min(1).max(10_000),
    variantId: z.uuid().nullable().default(null),
    position: z.int().min(0).max(100).optional(),
  })
  .strict();

const MAX_IMAGES_PER_PRODUCT = 30;

/**
 * Two-step upload: the back office asks for a short-lived, size- and type-limited
 * upload form, the browser sends the file straight to S3, then registers it here.
 * Image bytes never pass through our services.
 */
@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage | null,
  ) {}

  async createUpload(
    productId: string,
    contentType: keyof typeof IMAGE_TYPES,
  ): Promise<PresignedUpload> {
    const storage = this.requireStorage();
    await this.requireProduct(productId);
    // Random, product-scoped key: uploads cannot overwrite each other or other products' images.
    const key = `products/${productId}/${randomUUID()}.${IMAGE_TYPES[contentType]}`;
    return storage.presignUpload(key, contentType, this.config.IMAGE_MAX_BYTES);
  }

  async register(productId: string, input: z.infer<typeof RegisterImageSchema>): Promise<string> {
    const storage = this.requireStorage();
    if (!input.key.startsWith(`products/${productId}/`) || input.key.includes('..')) {
      throw new DomainError(
        ErrorCode.VALIDATION_FAILED,
        'Image key does not belong to this product',
        [{ path: 'key', message: 'Use the key returned by the upload endpoint' }],
      );
    }
    if (!(await storage.exists(input.key))) {
      throw new DomainError(ErrorCode.CONFLICT, 'The image has not been uploaded yet');
    }
    return this.db.transaction(async (tx) => {
      await this.requireProduct(productId, tx);
      if (input.variantId) {
        const [variant] = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(
            and(eq(productVariants.id, input.variantId), eq(productVariants.productId, productId)),
          );
        if (!variant) throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'Variant not found');
      }
      const [{ total } = { total: 0 }] = await tx
        .select({ total: count() })
        .from(productImages)
        .where(eq(productImages.productId, productId));
      if (total >= MAX_IMAGES_PER_PRODUCT)
        throw new DomainError(ErrorCode.CONFLICT, 'Too many images for this product');
      const [row] = await tx
        .insert(productImages)
        .values({
          productId,
          variantId: input.variantId,
          storageKey: input.key,
          url: new URL(input.key, `${this.assetBaseUrl()}/`).toString(),
          alt: input.alt,
          width: input.width,
          height: input.height,
          position: input.position ?? total,
        })
        .returning({ id: productImages.id });
      await tx.update(products).set({ updatedAt: new Date() }).where(eq(products.id, productId));
      if (!row) throw new Error('image insert returned no row');
      return row.id;
    });
  }

  async remove(productId: string, imageId: string): Promise<void> {
    const [row] = await this.db
      .delete(productImages)
      .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
      .returning({ key: productImages.storageKey });
    if (!row) throw new DomainError(ErrorCode.NOT_FOUND, 'Image not found');
    // Best effort: an orphaned object is harmless and a lifecycle rule can sweep it.
    await this.storage?.delete(row.key).catch((error: unknown) => {
      this.logger.warn(`could not delete ${row.key}: ${String(error)}`);
    });
  }

  private requireStorage(): ObjectStorage {
    if (!this.storage || !this.config.ASSET_BASE_URL) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Image storage is not configured');
    }
    return this.storage;
  }

  private assetBaseUrl(): string {
    return (this.config.ASSET_BASE_URL ?? '').replace(/\/$/, '');
  }

  private async requireProduct(productId: string, tx: Database = this.db): Promise<void> {
    const [row] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (!row) throw new DomainError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found');
  }
}
