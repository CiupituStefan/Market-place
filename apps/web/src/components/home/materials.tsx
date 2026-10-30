import Image from 'next/image';
import type { ReactNode } from 'react';
import Link from '@/components/i18n/link';
import { ProductArt } from '@/components/product/product-art';
import type { ProductPreview } from '@/lib/catalog';
import { WORLD_IMAGES, type ImageCredit } from '@/lib/image-credits';
import type { I18n } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';

function Row({
  title,
  body,
  href,
  link,
  picture,
  wide = false,
}: {
  title: string;
  body: string;
  href: string;
  link: string;
  picture: ReactNode;
  wide?: boolean;
}) {
  return (
    <li
      data-reveal
      className="grid gap-8 border-t-2 border-foreground pt-6 lg:grid-cols-12 lg:gap-8"
    >
      <div className="lg:col-span-5">
        <h3 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-lg leading-relaxed">{body}</p>
        <Link
          href={href}
          className="mt-6 inline-block text-base font-semibold text-brand underline underline-offset-4 hover:no-underline"
        >
          {link}
        </Link>
      </div>
      <div className={cn(wide ? 'lg:col-span-7' : 'lg:col-span-5 lg:col-start-8')}>{picture}</div>
    </li>
  );
}

function Photo({ image, alt, wide }: { image: ImageCredit; alt: string; wide?: boolean }) {
  return (
    <figure>
      <Image
        src={image.src}
        width={image.width}
        height={image.height}
        alt={alt}
        sizes={wide ? '(min-width: 1024px) 55vw, 100vw' : '(min-width: 1024px) 40vw, 100vw'}
        className={cn('h-auto w-full', !wide && 'aspect-[5/4] object-cover')}
      />
      <figcaption className="mt-3 text-sm text-muted-foreground">
        {alt}. {image.creator}, {image.licence}.
      </figcaption>
    </figure>
  );
}

function Drawing({ preview, alt }: { preview: ProductPreview; alt: string }) {
  return (
    <figure>
      <div className="flex aspect-[4/3] items-center justify-center bg-stage p-[8%]">
        <ProductArt preview={preview} quality="full" title={alt} className="w-full" />
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">{alt}</figcaption>
    </figure>
  );
}

/**
 * What the boards are made of, one material per row, each beside a picture of that material
 * in the world (or, where no honest picture exists, a drawing of the part itself). Every fact
 * comes from the catalogue's own specs.
 */
export function Materials({
  i18n,
  aluminium,
  switchPreview,
  buildPreview,
  basePrice,
}: {
  i18n: I18n;
  /** Names of the keyboards with aluminium cases. */
  aluminium: string[];
  switchPreview: ProductPreview | null;
  buildPreview: ProductPreview | null;
  basePrice: string | null;
}) {
  const copy = i18n.t.home.materials;
  const list = new Intl.ListFormat(i18n.locale, { type: 'conjunction' });

  return (
    <section aria-labelledby="materials-title" className="container-page py-24 lg:py-32">
      <h2
        id="materials-title"
        data-reveal
        className="display text-[clamp(3rem,7vw,7rem)] whitespace-pre-line"
      >
        {copy.title}
      </h2>
      <ol className="mt-16 grid gap-20 lg:gap-28">
        {aluminium.length > 0 && (
          <Row
            title={copy.aluminium.title}
            body={copy.aluminium.body(list.format(aluminium))}
            href="/shop/keyboards?material=Aluminium"
            link={copy.aluminium.link}
            wide
            picture={<Photo image={WORLD_IMAGES.machined} alt={copy.aluminium.picture} wide />}
          />
        )}
        <Row
          title={copy.keycaps.title}
          body={copy.keycaps.body}
          href="/shop/keycaps"
          link={copy.keycaps.link}
          picture={<Photo image={WORLD_IMAGES.typewriter} alt={copy.keycaps.picture} />}
        />
        {switchPreview && (
          <Row
            title={copy.switches.title}
            body={copy.switches.body}
            href="/shop/switches"
            link={copy.switches.link}
            picture={<Drawing preview={switchPreview} alt={copy.switches.picture} />}
          />
        )}
        <Row
          title={copy.walnut.title}
          body={copy.walnut.body}
          href="/product/walnut-wrist-rest"
          link={copy.walnut.link}
          picture={<Photo image={WORLD_IMAGES.woods} alt={copy.walnut.picture} />}
        />
        {basePrice && buildPreview && (
          <Row
            title={copy.build.title}
            body={copy.build.body(basePrice)}
            href="/configurator"
            link={copy.build.link}
            wide
            picture={<Drawing preview={buildPreview} alt={copy.build.picture} />}
          />
        )}
      </ol>
    </section>
  );
}
