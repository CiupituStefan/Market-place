import { describe, expect, it } from 'vitest';
import { products } from '@/test/catalog-fixtures';
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd } from './structured-data';

describe('structured data', () => {
  it('escapes < so JSON-LD cannot close its script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' });
  });

  it('describes a product group with one offer per variant', () => {
    const product = products.find((p) => p.slug === 'cse-forge-75')!;
    const json = productJsonLd(product) as {
      hasVariant: { sku: string; offers: { price: string; availability: string } }[];
    };
    expect(json).toMatchObject({
      '@type': 'ProductGroup',
      name: 'CSE Forge 75',
      variesBy: ['Color', 'Switch'],
    });
    expect(json.hasVariant).toHaveLength(product.variants.length);
    const soldOut = json.hasVariant.find((v) => v.sku.includes('CHA-CLI'));
    expect(soldOut?.offers.availability).toBe('https://schema.org/OutOfStock');
    expect(json.hasVariant[0]?.offers.price).toBe('189.00');
  });

  it('builds absolute breadcrumb URLs', () => {
    const json = breadcrumbJsonLd([
      { name: 'Home', href: '/' },
      { name: 'Shop', href: '/shop' },
    ]) as {
      itemListElement: { position: number; item: string }[];
    };
    expect(json.itemListElement[1]).toMatchObject({
      position: 2,
      item: 'http://localhost:3000/shop',
    });
  });
});
