import type { Category, Product, Variant } from '@/lib/catalog/schemas';
import { LOCALE_INFO, localizePath, type Locale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/messages';
import { absoluteUrl, siteConfig } from '@/lib/site';

const localUrl = (path: string, locale: Locale) => absoluteUrl(localizePath(path, locale));

/**
 * schema.org builders. Values come from catalog data rendered on the page, so
 * structured data never contradicts what shoppers see (a Google requirement).
 */

type JsonLd = Record<string, unknown>;

/** Serialises JSON-LD for a <script> tag, escaping `<` to prevent breaking out of it (XSS). */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function organizationJsonLd(locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: localUrl('/', locale),
    logo: absoluteUrl('/icon.svg'),
    ...(siteConfig.social.length > 0 ? { sameAs: siteConfig.social } : {}),
  };
}

export function websiteJsonLd(locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: localUrl('/', locale),
    inLanguage: LOCALE_INFO[locale].htmlLang,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${localUrl('/search', locale)}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[], locale: Locale): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: localUrl(crumb.href, locale),
    })),
  };
}

const AVAILABILITY: Record<Variant['availability'], string> = {
  IN_STOCK: 'https://schema.org/InStock',
  LOW_STOCK: 'https://schema.org/LimitedAvailability',
  OUT_OF_STOCK: 'https://schema.org/OutOfStock',
  PREORDER: 'https://schema.org/PreOrder',
};

export function productJsonLd(product: Product, locale: Locale): JsonLd {
  const url = localUrl(`/product/${product.slug}`, locale);
  const optionLabel = (variant: Variant) =>
    product.options
      .map((option) => option.values.find((v) => v.value === variant.options[option.key])?.label)
      .filter(Boolean)
      .join(' / ');
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    name: product.name,
    description: product.description.join(' '),
    url,
    brand: { '@type': 'Brand', name: product.brand },
    productGroupID: product.id,
    variesBy: product.options.map((o) => o.name),
    ...(product.images.length > 0 ? { image: product.images.map((i) => i.url) } : {}),
    ...(product.rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
          },
        }
      : {}),
    hasVariant: product.variants.map((variant) => ({
      '@type': 'Product',
      sku: variant.sku,
      name: `${product.name} — ${optionLabel(variant)}`,
      offers: {
        '@type': 'Offer',
        url,
        price: (variant.price.amount / 100).toFixed(2),
        priceCurrency: variant.price.currency,
        availability: AVAILABILITY[variant.availability],
        itemCondition: 'https://schema.org/NewCondition',
      },
    })),
  };
}

export function categoryCrumbs(trail: Category[], t: Messages): Crumb[] {
  return [
    { name: t.shop.home, href: '/' },
    { name: t.shop.shop, href: '/shop' },
    ...trail.map((c) => ({ name: c.name, href: `/shop/${c.slug}` })),
  ];
}
