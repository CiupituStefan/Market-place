'use client';

import {
  BadgeSchema,
  KEYBOARD_LAYOUTS,
  PRODUCT_KINDS,
  type Badge,
  type ProductKind,
  type ProductPreview,
} from '@market/types';
import { useId, useState } from 'react';
import { FormField } from '@/components/auth/form-field';
import { Label } from '@/components/ui/label';
import { useCategories } from '@/lib/api/admin';
import { formText, SelectField, TextAreaField } from './admin-page';

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

export interface ProductDetails {
  name: string;
  slug: string;
  brand: string;
  categorySlug: string;
  kind: ProductKind;
  tagline: string;
  description: string[];
  highlights: string[];
  badges: Badge[];
  preview: ProductPreview;
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Reads the details fields; returns errors keyed by field name. */
export function readDetails(data: FormData): {
  details: ProductDetails;
  errors: Record<string, string>;
} {
  const text = (k: string) => formText(data, k);
  const kind = text('kind') as ProductKind;
  const layout = text('preview.layout');
  const details: ProductDetails = {
    name: text('name'),
    slug: text('slug'),
    brand: text('brand'),
    categorySlug: text('categorySlug'),
    kind,
    tagline: text('tagline'),
    description: paragraphs(text('description')),
    highlights: lines(text('highlights')),
    badges: data.getAll('badges').map(String) as Badge[],
    preview: {
      kind,
      ...(kind === 'keyboard' && layout ? { layout: layout as ProductPreview['layout'] } : {}),
      caseColor: text('preview.caseColor'),
      keyColor: text('preview.keyColor'),
      accentColor: text('preview.accentColor'),
      legendColor: text('preview.legendColor'),
    },
  };
  const errors: Record<string, string> = {};
  if (!details.name) errors.name = 'Required';
  if (!SLUG.test(details.slug) || details.slug === 'manage')
    errors.slug = 'Lowercase letters, digits and single hyphens';
  if (!details.brand) errors.brand = 'Required';
  if (!details.categorySlug) errors.categorySlug = 'Choose a category';
  if (details.tagline.length > 160) errors.tagline = 'At most 160 characters';
  if (details.highlights.some((h) => h.length > 200))
    errors.highlights = 'Each line at most 200 characters';
  for (const key of ['caseColor', 'keyColor', 'accentColor', 'legendColor'] as const) {
    if (!HEX.test(details.preview[key])) errors[`preview.${key}`] = 'A colour like #1f2933';
  }
  return { details, errors };
}

const DEFAULT_PREVIEW: ProductPreview = {
  kind: 'keyboard',
  layout: '75%',
  caseColor: '#2b2f36',
  keyColor: '#e8e4dc',
  accentColor: '#c8693a',
  legendColor: '#2b2f36',
};

export function DetailsFields({
  initial,
  errors,
}: {
  initial?: Partial<ProductDetails>;
  errors: Record<string, string>;
}) {
  const categories = useCategories();
  const [kind, setKind] = useState<ProductKind>(initial?.kind ?? 'keyboard');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const badgeId = useId();
  const preview = initial?.preview ?? DEFAULT_PREVIEW;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Name"
          name="name"
          defaultValue={initial?.name}
          error={errors.name}
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
        <FormField
          label="Slug (URL)"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          hint={`/product/${slug || '…'}`}
          error={errors.slug}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          label="Brand"
          name="brand"
          defaultValue={initial?.brand ?? 'CSE'}
          error={errors.brand}
        />
        <SelectField
          label="Category"
          name="categorySlug"
          defaultValue={initial?.categorySlug ?? ''}
          options={[
            { value: '', label: categories.isPending ? 'Loading…' : 'Choose…' },
            ...(categories.data ?? []).map((c) => ({ value: c.slug, label: c.name })),
          ]}
        />
        <SelectField
          label="Kind"
          name="kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as ProductKind);
          }}
          options={PRODUCT_KINDS.map((k) => ({ value: k, label: k }))}
        />
      </div>
      {errors.categorySlug && (
        <p className="-mt-2 text-xs text-destructive">{errors.categorySlug}</p>
      )}
      <FormField
        label="Tagline"
        name="tagline"
        defaultValue={initial?.tagline}
        maxLength={160}
        error={errors.tagline}
      />
      <TextAreaField
        label="Description"
        name="description"
        rows={5}
        defaultValue={initial?.description?.join('\n\n')}
        hint="Separate paragraphs with an empty line."
      />
      <TextAreaField
        label="Highlights"
        name="highlights"
        rows={4}
        defaultValue={initial?.highlights?.join('\n')}
        hint="One per line."
        error={errors.highlights}
      />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Badges</legend>
        <div className="flex flex-wrap gap-4">
          {BadgeSchema.options.map((badge) => (
            <div key={badge} className="flex items-center gap-2">
              <input
                id={`${badgeId}-${badge}`}
                type="checkbox"
                name="badges"
                value={badge}
                defaultChecked={initial?.badges?.includes(badge)}
                className="size-4 accent-[var(--brand)]"
              />
              <Label htmlFor={`${badgeId}-${badge}`}>{badge.toLowerCase()}</Label>
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          Preview art (used until photos are uploaded)
        </legend>
        {kind === 'keyboard' && (
          <SelectField
            label="Layout"
            name="preview.layout"
            defaultValue={preview.layout ?? '75%'}
            options={KEYBOARD_LAYOUTS.map((l) => ({ value: l, label: l }))}
          />
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['caseColor', 'keyColor', 'accentColor', 'legendColor'] as const).map((key) => (
            <ColorField
              key={key}
              name={`preview.${key}`}
              label={key.replace('Color', '')}
              defaultValue={preview[key]}
              error={errors[`preview.${key}`]}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function ColorField({
  name,
  label,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="capitalize">
        {label}
      </Label>
      <input
        id={id}
        type="color"
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full cursor-pointer rounded-lg border bg-background p-1"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
