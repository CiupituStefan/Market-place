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

/** Public responses are identical for every visitor, so CDNs and the storefront may cache them briefly. */
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
  ): Promise<ProductListing> {
    return this.reader.list(query);
  }

  @Get('products/:slug')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Published product with variants, specs and images' })
  @ApiOkResponse({ schema: openApiSchema(ProductSchema) })
  product(@Param('slug', new ZodValidationPipe(SlugSchema)) slug: string): Promise<Product> {
    return this.reader.getPublishedBySlug(slug);
  }

  @Get('products/:slug/related')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Related products (same category first)' })
  related(
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
  ): Promise<ProductSummary[]> {
    return this.reader.related(slug);
  }

  @Get('categories')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOkResponse({ schema: openApiSchema(z.array(CategorySchema)) })
  categories(): Promise<Category[]> {
    return this.reader.categories();
  }

  @Get('categories/:slug')
  @Header('cache-control', PUBLIC_CACHE)
  @ApiOkResponse({ schema: openApiSchema(CategorySchema) })
  category(@Param('slug', new ZodValidationPipe(SlugSchema)) slug: string): Promise<Category> {
    return this.reader.category(slug);
  }
}
