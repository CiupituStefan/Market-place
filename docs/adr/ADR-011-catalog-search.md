# ADR-011: Catalog search on PostgreSQL first, behind a search interface

- Status: Accepted
- Date: 2026-10-05

## Context

Shoppers search by product name, brand, SKU, category and attributes, and expect filters with
counts (facets) and typo tolerance. The launch catalog has tens to a few thousand products.

## Decision

- Search runs in product-service's PostgreSQL:
  - a denormalised `search_document` per product, rebuilt on every catalog write;
  - a generated `tsvector` column (GIN index) queried with sanitised prefix tsqueries;
  - `pg_trgm` word similarity (GIN trigram index) for typos;
  - an escaped substring match for exact SKUs;
  - facet counts computed per attribute, each ignoring its own selection.
- Controllers depend on a `CatalogSearch` interface, not on SQL.

## Alternatives considered

- **OpenSearch / Elasticsearch now**: better relevance tuning, synonyms, language analysers and
  scale, but another cluster to run, secure and keep in sync. Premature for this catalog size.
- **Algolia / managed SaaS search**: excellent UX, recurring cost and data leaving our platform.

## Consequences

- No extra infrastructure; search is transactionally consistent with the catalog.
- Moving to OpenSearch later: index documents from `ProductCreated`/`ProductUpdated` events and
  implement `CatalogSearch` against it. The API contract (`CatalogQuerySchema`,
  `ProductListingSchema`) stays the same, so the storefront is unaffected.
- The `simple` text configuration does no stemming; synonyms and language-aware ranking are the
  main reasons to migrate.
