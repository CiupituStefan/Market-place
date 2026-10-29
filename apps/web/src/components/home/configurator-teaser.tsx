'use client';

import { ArrowRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { useState } from 'react';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { KEYBOARD_LAYOUTS, type KeyboardLayout, type ProductPreview } from '@/lib/catalog/schemas';
import { cn } from '@/lib/utils';

/**
 * Homepage teaser: changes only the rendering. The real configurator
 * (/configurator) gets prices, rules and configuration IDs from product-service.
 */
const CASES = [
  {
    value: 'black',
    colors: { caseColor: '#2a2c31', keyColor: '#3b3e45', legendColor: '#d9d4ca' },
  },
  {
    value: 'white',
    colors: { caseColor: '#e6e1d8', keyColor: '#f6f3ec', legendColor: '#45474d' },
  },
  {
    value: 'silver',
    colors: { caseColor: '#b8bbc0', keyColor: '#ebe9e4', legendColor: '#33363b' },
  },
] as const;

const ACCENTS = [
  { value: '#c8743f', key: 'copper' },
  { value: '#2f6f8f', key: 'teal' },
  { value: '#5d7356', key: 'olive' },
] as const;

export function ConfiguratorTeaser() {
  const { t } = useI18n();
  const copy = t.home.configurator;
  const [layout, setLayout] = useState<KeyboardLayout>('75%');
  const [caseValue, setCaseValue] = useState<(typeof CASES)[number]['value']>('black');
  const [accent, setAccent] = useState<string>(ACCENTS[0].value);

  const selectedCase = CASES.find((c) => c.value === caseValue) ?? CASES[0];
  const preview: ProductPreview = {
    kind: 'keyboard',
    layout,
    accentColor: accent,
    ...selectedCase.colors,
  };

  return (
    <div className="grid overflow-hidden rounded-3xl border bg-card lg:grid-cols-[1.3fr_1fr]">
      <div className="flex items-center justify-center bg-stage p-6 md:p-12">
        <ProductArt
          preview={preview}
          quality="full"
          title={copy.preview(layout, copy.cases[selectedCase.value])}
          className="w-full transition-all duration-500"
        />
      </div>
      <div className="flex flex-col gap-8 p-6 md:p-10">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="configurator-title" className="mt-3 text-3xl font-semibold tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-3 text-muted-foreground">{copy.body}</p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">{copy.layout}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {KEYBOARD_LAYOUTS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={layout === value}
                onClick={() => {
                  setLayout(value);
                }}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors',
                  layout === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-6">
          <fieldset>
            <legend className="text-sm font-medium">{copy.case}</legend>
            <div className="mt-3 flex gap-2">
              {CASES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={copy.caseLabel(copy.cases[c.value])}
                  aria-pressed={caseValue === c.value}
                  onClick={() => {
                    setCaseValue(c.value);
                  }}
                  className={cn(
                    'size-8 rounded-full border-2 ring-offset-2 ring-offset-card transition',
                    caseValue === c.value ? 'ring-2 ring-foreground' : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: c.colors.caseColor }}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">{copy.accent}</legend>
            <div className="mt-3 flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  aria-label={copy.accentLabel(copy.accents[a.key])}
                  aria-pressed={accent === a.value}
                  onClick={() => {
                    setAccent(a.value);
                  }}
                  className={cn(
                    'size-8 rounded-full border-2 ring-offset-2 ring-offset-card transition',
                    accent === a.value ? 'ring-2 ring-foreground' : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: a.value }}
                />
              ))}
            </div>
          </fieldset>
        </div>

        <ol className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-6 font-mono text-xs text-muted-foreground">
          {copy.steps.map((step, index) => (
            <li key={step}>
              <span className="text-brand">{String(index + 1).padStart(2, '0')}</span> {step}
            </li>
          ))}
        </ol>

        <Button size="lg" asChild className="mt-auto self-start">
          <Link href="/configurator">
            {copy.start} <ArrowRightIcon />
          </Link>
        </Button>
      </div>
    </div>
  );
}
