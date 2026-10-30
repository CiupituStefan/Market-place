import { ArrowRightIcon } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/i18n/link';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import type { I18n } from '@/lib/i18n/core';
import { PHOTOS } from '@/lib/knowledge/photos';

/**
 * The keyboard behind the guide: the thesis prototype, photographed, with the four numbers that
 * were measured on it. Said plainly that it is not a product for sale.
 */
export function PrototypeStory({ i18n }: { i18n: I18n }) {
  const copy = i18n.t.home.prototype;
  const stats = [copy.stats.usb, copy.stats.ble, copy.stats.rollover, copy.stats.soc];
  const main = PHOTOS.prototype;
  const pcb = PHOTOS.pcb;
  const frame = PHOTOS['case-top'];

  return (
    <section aria-labelledby="prototype-title" className="container-page py-24">
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
        <Reveal className="lg:col-span-5">
          <h2
            id="prototype-title"
            data-animate
            className="display text-[clamp(2.25rem,4.4vw,4rem)] whitespace-pre-line"
          >
            {copy.title}
          </h2>
          <p data-animate className="mt-5 max-w-lg text-lg leading-relaxed">
            {copy.body}
          </p>
          <p data-animate className="mt-3 max-w-lg text-[0.9375rem] text-muted-foreground">
            {copy.note}
          </p>
          <dl data-animate className="mt-8 grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="panel rounded-2xl p-4">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-[clamp(1.5rem,2.4vw,2rem)] font-semibold tracking-tight tabular-nums">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <Link
            data-animate
            href="/learn/prototype"
            className="mt-8 inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-brand hover:underline"
          >
            {copy.action} <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-6 gap-3 lg:col-span-7">
          <figure className="col-span-6">
            <div className="overflow-hidden rounded-3xl bg-white p-6 shadow-lg sm:p-10">
              <Parallax depth={4}>
                <Image
                  src={main.src}
                  width={main.width}
                  height={main.height}
                  alt={copy.photos.prototype}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="mx-auto h-auto w-full max-w-xl"
                />
              </Parallax>
            </div>
            <figcaption className="mt-2 text-sm text-muted-foreground">
              {copy.photos.prototype}
            </figcaption>
          </figure>
          {[
            { photo: pcb, caption: copy.photos.pcb },
            { photo: frame, caption: copy.photos.case },
          ].map(({ photo, caption }) => (
            <figure key={photo.src} className="col-span-6 sm:col-span-3">
              <div className="overflow-hidden rounded-2xl bg-white p-4">
                <Parallax depth={7}>
                  <Image
                    src={photo.src}
                    width={photo.width}
                    height={photo.height}
                    alt={caption}
                    sizes="(min-width: 1024px) 28vw, (min-width: 640px) 50vw, 100vw"
                    className="h-auto w-full"
                  />
                </Parallax>
              </div>
              <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
