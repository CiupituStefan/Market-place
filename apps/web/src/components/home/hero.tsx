import { ArrowRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { getI18n } from '@/lib/i18n/server';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import type { ProductPreview } from '@/lib/catalog/schemas';

const HERO_PREVIEW: ProductPreview = {
  kind: 'keyboard',
  layout: '75%',
  caseColor: '#2a2c31',
  keyColor: '#3b3e45',
  accentColor: '#c8743f',
  legendColor: '#d9d4ca',
};

export async function Hero() {
  const { t } = await getI18n();
  const copy = t.home.hero;
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(60%_60%_at_70%_30%,var(--brand-soft),transparent_70%)] opacity-70"
      />
      <div className="container-page relative grid items-center gap-12 pt-14 pb-20 lg:grid-cols-[1fr_1.15fr] lg:pt-24 lg:pb-28">
        <div className="max-w-xl animate-in duration-700 fade-in slide-in-from-bottom-4">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1
            id="hero-title"
            className="mt-4 text-5xl font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl"
          >
            {copy.title}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-pretty">{copy.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/shop/keyboards">
                {copy.shop} <ArrowRightIcon />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/configurator">{copy.build}</Link>
            </Button>
          </div>
          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t pt-6">
            {copy.specs.map((spec) => (
              <div key={spec.label}>
                <dt className="font-mono text-[0.68rem] tracking-wider text-muted-foreground uppercase">
                  {spec.label}
                </dt>
                <dd className="mt-1 font-medium">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative animate-in duration-1000 fade-in zoom-in-95">
          <div className="[perspective:1600px]">
            <div className="transition-transform duration-700 ease-out [transform:rotateX(32deg)_rotateZ(-7deg)] hover:[transform:rotateX(18deg)_rotateZ(-3deg)] motion-reduce:transform-none">
              <ProductArt preview={HERO_PREVIEW} quality="full" title={copy.artTitle} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
