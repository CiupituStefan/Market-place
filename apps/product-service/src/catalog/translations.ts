import type { Category, Product, ProductSummary } from '@market/types';
import { z } from 'zod';

/**
 * The catalog is written in English; other languages are optional overlays stored next to
 * it (`translations` jsonb, keyed by locale). Any field a translation leaves out falls back
 * to English, so a half-translated product still renders. Decision: ADR-026.
 */
export const CATALOG_LOCALES = ['en', 'ro'] as const;
export type CatalogLocale = (typeof CATALOG_LOCALES)[number];
type TranslatedLocale = Exclude<CatalogLocale, 'en'>;

/** `?locale=` on public reads; anything unknown is English rather than an error. */
export const LocaleParamSchema = z.enum(CATALOG_LOCALES).default('en').catch('en');

const Text = (max: number) => z.string().trim().min(1).max(max);
const Key = z.string().regex(/^[a-z0-9][a-zA-Z0-9-]{0,39}$/);

export const ProductTranslationSchema = z
  .object({
    name: Text(120),
    tagline: z.string().trim().max(160),
    description: z.array(Text(4_000)).max(20),
    highlights: z.array(Text(200)).max(12),
    included: z.array(Text(200)).max(20),
    compatibility: z.array(Text(200)).max(20),
    faq: z.array(z.object({ question: Text(300), answer: Text(2_000) })).max(30),
    specs: z
      .array(
        z.object({
          group: Text(60),
          items: z.array(z.object({ label: Text(60), value: Text(200) })).max(40),
        }),
      )
      .max(12),
    /** Option names and value labels by option key and value (the keys stay as they are). */
    options: z.record(
      Key,
      z
        .object({
          name: Text(40),
          values: z.record(
            Key,
            z
              .object({ label: Text(60), hint: Text(80) })
              .partial()
              .strict(),
          ),
        })
        .partial()
        .strict(),
    ),
  })
  .partial()
  .strict();
export type ProductTranslation = z.infer<typeof ProductTranslationSchema>;

export const CategoryTranslationSchema = z
  .object({ name: Text(80), description: z.string().trim().max(500) })
  .partial()
  .strict();
export type CategoryTranslation = z.infer<typeof CategoryTranslationSchema>;

export const ConfiguratorTranslationSchema = z
  .object({
    name: Text(120),
    description: z.string().trim().max(500),
    /** By `group:value`. */
    options: z.record(
      z.string(),
      z
        .object({ label: Text(60), description: Text(120) })
        .partial()
        .strict(),
    ),
    /** By `groupA:valueA+groupB:valueB`. */
    reasons: z.record(z.string(), Text(300)),
  })
  .partial()
  .strict();
export type ConfiguratorTranslation = z.infer<typeof ConfiguratorTranslationSchema>;

export const ProductTranslationsSchema = z
  .object({ ro: ProductTranslationSchema })
  .partial()
  .strict();
export const CategoryTranslationsSchema = z
  .object({ ro: CategoryTranslationSchema })
  .partial()
  .strict();
export type ProductTranslations = Partial<Record<TranslatedLocale, ProductTranslation>>;
export type CategoryTranslations = Partial<Record<TranslatedLocale, CategoryTranslation>>;
export type ConfiguratorTranslations = Partial<Record<TranslatedLocale, ConfiguratorTranslation>>;

export function translationFor<T>(
  translations: Partial<Record<TranslatedLocale, T>>,
  locale: CatalogLocale,
): T | undefined {
  return locale === 'en' ? undefined : translations[locale];
}

export function localizeSummary<T extends ProductSummary>(
  item: T,
  translations: ProductTranslations,
  locale: CatalogLocale,
): T {
  const t = translationFor(translations, locale);
  if (!t) return item;
  return { ...item, name: t.name ?? item.name, tagline: t.tagline ?? item.tagline };
}

export function localizeProduct<T extends Product>(
  product: T,
  translations: ProductTranslations,
  locale: CatalogLocale,
): T {
  const t = translationFor(translations, locale);
  if (!t) return product;
  return {
    ...localizeSummary(product, translations, locale),
    description: t.description ?? product.description,
    highlights: t.highlights ?? product.highlights,
    included: t.included ?? product.included,
    compatibility: t.compatibility ?? product.compatibility,
    faq: t.faq ?? product.faq,
    specs: t.specs ?? product.specs,
    options: product.options.map((option) => {
      const translated = t.options?.[option.key];
      if (!translated) return option;
      return {
        ...option,
        name: translated.name ?? option.name,
        values: option.values.map((value) => {
          const v = translated.values?.[value.value];
          if (!v) return value;
          const hint = v.hint ?? value.hint;
          return { ...value, label: v.label ?? value.label, ...(hint ? { hint } : {}) };
        }),
      };
    }),
  };
}

export function localizeCategory(
  category: Category,
  translations: CategoryTranslations,
  locale: CatalogLocale,
): Category {
  const t = translationFor(translations, locale);
  if (!t) return category;
  return {
    ...category,
    name: t.name ?? category.name,
    description: t.description ?? category.description,
  };
}

/** "Tastatură" also as "tastatura": shoppers often type without diacritics. */
export function withoutDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
