'use client';

import { useState, type PointerEvent } from 'react';
import type { ProductImage, ProductPreview } from '@/lib/catalog/schemas';
import { cn } from '@/lib/utils';
import { ProductMedia } from './product-media';

type Slide =
  | { kind: 'image'; image: ProductImage; label: string }
  | { kind: 'render'; view: 'front' | 'detail' | 'angle'; label: string };

interface ProductGalleryProps {
  name: string;
  images: ProductImage[];
  preview: ProductPreview;
}

const RENDER_SLIDES: Slide[] = [
  { kind: 'render', view: 'front', label: 'Top view' },
  { kind: 'render', view: 'angle', label: 'Angled view' },
  { kind: 'render', view: 'detail', label: 'Detail' },
];

/** The selected variant's own photos, otherwise the product's (an empty list is not "none"). */
export function galleryImages(
  product: { images: ProductImage[] },
  variant: { images: ProductImage[] } | null | undefined,
): ProductImage[] {
  return variant?.images.length ? variant.images : product.images;
}

export function ProductGallery({ name, images, preview }: ProductGalleryProps) {
  const slides: Slide[] =
    images.length > 0
      ? images.map((image, i) => ({ kind: 'image', image, label: `Image ${i + 1}` }))
      : RENDER_SLIDES;
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const slide = slides[Math.min(active, slides.length - 1)] ?? slides[0];

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl bg-stage md:aspect-[5/4]"
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          setZoom(null);
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center p-8 transition-transform duration-200 ease-out md:p-14 motion-reduce:transition-none"
          style={
            zoom ? { transform: 'scale(1.9)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined
          }
        >
          {slide?.kind === 'image' ? (
            <ProductMedia
              image={slide.image}
              preview={preview}
              alt={slide.image.alt || name}
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
            />
          ) : (
            <div className={cn('w-full', slide?.view === 'angle' && '[perspective:1400px]')}>
              <div
                className={cn(
                  slide?.view === 'angle' && '[transform:rotateX(38deg)_rotateZ(-10deg)]',
                )}
              >
                <ProductMedia
                  preview={preview}
                  quality="full"
                  view={slide?.view === 'detail' ? 'detail' : 'front'}
                  alt={`${name} — ${slide?.label ?? ''}`}
                />
              </div>
            </div>
          )}
        </div>
        <p className="pointer-events-none absolute bottom-4 left-4 hidden rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur md:block">
          Hover to zoom
        </p>
      </div>
      <div className="grid grid-cols-4 gap-3" role="group" aria-label="Product images">
        {slides.map((s, index) => (
          <button
            key={s.label}
            type="button"
            aria-label={`Show ${s.label.toLowerCase()}`}
            aria-pressed={index === active}
            onClick={() => {
              setActive(index);
            }}
            className={cn(
              'flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 bg-stage p-2 transition',
              index === active
                ? 'border-foreground'
                : 'border-transparent opacity-70 hover:opacity-100',
            )}
          >
            {s.kind === 'image' ? (
              <ProductMedia image={s.image} preview={preview} alt="" sizes="120px" />
            ) : (
              <div
                className={cn(
                  'w-full',
                  s.view === 'angle' &&
                    '[transform:perspective(400px)_rotateX(38deg)_rotateZ(-10deg)]',
                )}
              >
                <ProductMedia
                  preview={preview}
                  view={s.view === 'detail' ? 'detail' : 'front'}
                  alt=""
                />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
