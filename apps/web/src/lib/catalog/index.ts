import { fixtureSource, type CatalogSource } from './fixture-source';

/**
 * Catalog data access for Server Components. Phase 5 replaces the fixture
 * source with an HTTP source backed by product-service through the gateway.
 */
export const catalog: CatalogSource = fixtureSource;

export { categoryTrail, PAGE_SIZE, type ProductListing } from './fixture-source';
export * from './query';
export * from './schemas';
