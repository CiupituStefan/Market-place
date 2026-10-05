import Image from 'next/image';
import type { ProductImage, ProductPreview } from '@/lib/catalog/schemas';
import { cn } from '@/lib/utils';
import { ProductArt, type ArtView } from './product-art';

interface ProductMediaProps {
  image?: ProductImage | undefined;
  preview: ProductPreview;
  alt: string;
  view?: ArtView;
  quality?: 'lite' | 'full';
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/** Photography when available (S3 + CloudFront via next/image), procedural render otherwise. */
export function ProductMedia({
  image,
  preview,
  alt,
  view,
  quality,
  sizes,
  priority,
  className,
}: ProductMediaProps) {
  if (image) {
    return (
      <Image
        src={image.url}
        alt={image.alt || alt}
        width={image.width}
        height={image.height}
        sizes={sizes ?? '(min-width: 1024px) 25vw, 50vw'}
        preload={priority ?? false}
        className={cn('h-full w-full object-contain', className)}
      />
    );
  }
  return (
    <ProductArt
      preview={preview}
      view={view ?? 'front'}
      quality={quality ?? 'lite'}
      title={alt}
      className={className}
    />
  );
}
