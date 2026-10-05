import { Authenticated, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import type { Paginated, Product, ProductStatus } from '@market/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { PresignedUpload } from '../images/object-storage.js';
import {
  ImagesService,
  RegisterImageSchema,
  UploadRequestSchema,
} from '../images/images.service.js';
import { CatalogReaderService, type ManagedProductSummary } from './catalog-reader.service.js';
import { CatalogWriterService } from './catalog-writer.service.js';
import {
  CategoryInputSchema,
  CategoryUpdateSchema,
  CreateProductSchema,
  ManageListQuerySchema,
  UpdateProductSchema,
  VariantInputSchema,
  VariantUpdateSchema,
  type CategoryInput,
  type CreateProductInput,
  type UpdateProductInput,
  type VariantInput,
  type VariantUpdate,
} from './dto.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * Back-office catalog management (STAFF and ADMIN; archiving is ADMIN only).
 * Registered before the public controller so `/products/manage` wins over `/products/:slug`.
 */
@ApiTags('catalog (back office)')
@Controller()
@Authenticated('STAFF', 'ADMIN')
export class CatalogAdminController {
  constructor(
    private readonly reader: CatalogReaderService,
    private readonly writer: CatalogWriterService,
    private readonly images: ImagesService,
  ) {}

  @Get('products/manage')
  @ApiOperation({ summary: 'All products in any status' })
  manageList(
    @Query(new ZodValidationPipe(ManageListQuerySchema))
    query: z.infer<typeof ManageListQuerySchema>,
  ): Promise<Paginated<ManagedProductSummary>> {
    return this.reader.manageList(query);
  }

  @Get('products/manage/:id')
  manageOne(@Param('id', uuid) id: string): Promise<Product & { status: ProductStatus }> {
    return this.reader.getById(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product (as DRAFT) with its variants' })
  @ApiBody({ schema: openApiSchema(CreateProductSchema) })
  async create(
    @Body(new ZodValidationPipe(CreateProductSchema)) body: CreateProductInput,
  ): Promise<{ id: string }> {
    return { id: await this.writer.create(body) };
  }

  @Patch('products/:id')
  @HttpCode(204)
  @ApiBody({ schema: openApiSchema(UpdateProductSchema) })
  update(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) body: UpdateProductInput,
  ): Promise<void> {
    return this.writer.update(id, body);
  }

  @Delete('products/:id')
  @HttpCode(204)
  @Authenticated('ADMIN')
  @ApiOperation({ summary: 'Archive a product (kept for order history, hidden from the store)' })
  archive(@Param('id', uuid) id: string): Promise<void> {
    return this.writer.setStatus(id, 'ARCHIVED');
  }

  @Post('products/:id/publish')
  @HttpCode(204)
  publish(@Param('id', uuid) id: string): Promise<void> {
    return this.writer.setStatus(id, 'PUBLISHED');
  }

  @Post('products/:id/unpublish')
  @HttpCode(204)
  unpublish(@Param('id', uuid) id: string): Promise<void> {
    return this.writer.setStatus(id, 'DRAFT');
  }

  @Post('products/:id/variants')
  @ApiBody({ schema: openApiSchema(VariantInputSchema) })
  async addVariant(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(VariantInputSchema)) body: VariantInput,
  ): Promise<{ id: string }> {
    return { id: await this.writer.addVariant(id, body) };
  }

  @Patch('products/:id/variants/:variantId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Change price, compare-at price, availability or preview' })
  @ApiBody({ schema: openApiSchema(VariantUpdateSchema) })
  updateVariant(
    @Param('id', uuid) id: string,
    @Param('variantId', uuid) variantId: string,
    @Body(new ZodValidationPipe(VariantUpdateSchema)) body: VariantUpdate,
  ): Promise<void> {
    return this.writer.updateVariant(id, variantId, body);
  }

  @Delete('products/:id/variants/:variantId')
  @HttpCode(204)
  removeVariant(
    @Param('id', uuid) id: string,
    @Param('variantId', uuid) variantId: string,
  ): Promise<void> {
    return this.writer.removeVariant(id, variantId);
  }

  @Post('products/:id/images/upload-url')
  @ApiOperation({ summary: 'Short-lived S3 upload form (type and size enforced by S3)' })
  @ApiBody({ schema: openApiSchema(UploadRequestSchema) })
  uploadUrl(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(UploadRequestSchema)) body: z.infer<typeof UploadRequestSchema>,
  ): Promise<PresignedUpload> {
    return this.images.createUpload(id, body.contentType);
  }

  @Post('products/:id/images')
  @ApiOperation({ summary: 'Register an uploaded image' })
  @ApiBody({ schema: openApiSchema(RegisterImageSchema) })
  async registerImage(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(RegisterImageSchema)) body: z.infer<typeof RegisterImageSchema>,
  ): Promise<{ id: string }> {
    return { id: await this.images.register(id, body) };
  }

  @Delete('products/:id/images/:imageId')
  @HttpCode(204)
  removeImage(
    @Param('id', uuid) id: string,
    @Param('imageId', uuid) imageId: string,
  ): Promise<void> {
    return this.images.remove(id, imageId);
  }

  @Post('categories')
  @ApiBody({ schema: openApiSchema(CategoryInputSchema) })
  async createCategory(
    @Body(new ZodValidationPipe(CategoryInputSchema)) body: CategoryInput,
  ): Promise<{ id: string }> {
    return { id: await this.writer.createCategory(body) };
  }

  @Patch('categories/:id')
  @HttpCode(204)
  @ApiBody({ schema: openApiSchema(CategoryUpdateSchema) })
  updateCategory(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(CategoryUpdateSchema)) body: Partial<CategoryInput>,
  ): Promise<void> {
    return this.writer.updateCategory(id, body);
  }
}
