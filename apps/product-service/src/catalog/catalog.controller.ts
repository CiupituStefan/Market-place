import { openApiSchema, ZodValidationPipe } from '@market/nest-common';
import {
  CatalogQuerySchema,
  CategorySchema,
  ProductListingSchema,
  ProductSchema,
  type CatalogQuery,
  type Category,
  type Product,
  type ProductListing,
  type ProductSummary,
} from '@market/types';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CatalogReaderService } from './catalog-reader.service.js';
import { SlugSchema } from './dto.js';
import { LocaleParamSchema, type CatalogLocale } from './translations.js';

/**
 * Public responses are identical for every visitor (per URL, `?locale=` included), so CDNs
 * and the storefront may cache them briefly.
 */
const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly reader: CatalogReaderService) {}

  @Get('products')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'List, filter, sort and search published products (with facets)' })
  @ApiOkResponse({ schema: openApiSchema(ProductListingSchema) })
  list(
    @Query(new ZodValidationPipe(CatalogQuerySchema)) query: CatalogQuery,
    @Query('locale', new ZodValidationPipe(LocaleParamSchema)) locale: CatalogLocale,
  ): Promise<ProductListing> {
    return this.reader.list(query, locale);
  }

  @Get('products/:slug')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Published product with variants, specs and images' })
  @ApiOkResponse({ schema: openApiSchema(ProductSchema) })
  product(
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
    @Query('locale', new ZodValidationPipe(LocaleParamSchema)) locale: CatalogLocale,
  ): Promise<Product> {
    return this.reader.getPublishedBySlug(slug, locale);
  }

  @Get('products/:slug/related')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Related products (same category first)' })
  related(
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
    @Query('locale', new ZodValidationPipe(LocaleParamSchema)) locale: CatalogLocale,
  ): Promise<ProductSummary[]> {
    return this.reader.related(slug, locale);
  }

  @Get('categories')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOkResponse({ schema: openApiSchema(z.array(CategorySchema)) })
  categories(
    @Query('locale', new ZodValidationPipe(LocaleParamSchema)) locale: CatalogLocale,
  ): Promise<Category[]> {
    return this.reader.categories(locale);
  }

  @Get('categories/:slug')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOkResponse({ schema: openApiSchema(CategorySchema) })
  category(
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
    @Query('locale', new ZodValidationPipe(LocaleParamSchema)) locale: CatalogLocale,
  ): Promise<Category> {
    return this.reader.category(slug, locale);
  }
}
