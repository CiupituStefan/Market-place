import { describe, expect, it } from 'vitest';
import { galleryImages } from './product-gallery';

const image = (url: string) => ({ url, alt: url, width: 800, height: 600 });

describe('galleryImages', () => {
  it('falls back to product photos when the variant has none', () => {
    const product = { images: [image('https://cdn.test/p.png')] };
    expect(galleryImages(product, { images: [] })).toEqual(product.images);
    expect(galleryImages(product, undefined)).toEqual(product.images);
  });

  it('prefers the variant’s own photos', () => {
    const variant = { images: [image('https://cdn.test/v.png')] };
    expect(galleryImages({ images: [image('https://cdn.test/p.png')] }, variant)).toEqual(
      variant.images,
    );
  });
});
