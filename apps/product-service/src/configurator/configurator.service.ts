import { createHash } from 'node:crypto';
import {
  CONFIGURATOR_GROUPS,
  DomainError,
  ErrorCode,
  type ConfigurationQuote,
  type ConfigurationSelection,
  type Configurator,
  type ConfiguratorGroup,
  type Currency,
} from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { configuratorIncompatibilities, configuratorOptions, configurators } from '../db/schema.js';
import { money } from '../catalog/mappers.js';
import { translationFor, type CatalogLocale } from '../catalog/translations.js';

/** Fixed copy per language; option labels and rule reasons are data (`translations`). */
const COPY: Record<
  CatalogLocale,
  {
    groups: Record<ConfiguratorGroup, string>;
    choose: (group: string) => string;
    unknown: (value: string) => string;
    unavailable: (label: string) => string;
    base: (name: string) => string;
  }
> = {
  en: {
    groups: {
      layout: 'Layout',
      case: 'Case',
      switch: 'Switches',
      plate: 'Plate',
      keycaps: 'Keycaps',
      connection: 'Connection',
    },
    choose: (group) => `Choose a ${group.toLowerCase()}`,
    unknown: (value) => `Unknown option "${value}"`,
    unavailable: (label) => `${label} is currently unavailable`,
    base: (name) => `${name} base`,
  },
  ro: {
    groups: {
      layout: 'Format',
      case: 'Carcasă',
      switch: 'Switch-uri',
      plate: 'Placă',
      keycaps: 'Keycaps',
      connection: 'Conexiune',
    },
    choose: (group) => `Alege: ${group.toLowerCase()}`,
    unknown: (value) => `Opțiune necunoscută: „${value}”`,
    unavailable: (label) => `${label} nu este disponibil momentan`,
    base: (name) => `${name} – bază`,
  },
};

/** Same configurator + same selection → same id, so carts and orders can reference it. */
export function configurationId(slug: string, selection: ConfigurationSelection): string {
  const canonical = CONFIGURATOR_GROUPS.map((group) => `${group}=${selection[group] ?? ''}`).join(
    '&',
  );
  return `cfg_${createHash('sha256').update(`${slug}|${canonical}`).digest('hex').slice(0, 20)}`;
}

/**
 * Configurator rules live on the server: the browser only proposes a selection,
 * this service validates it and computes price, SKU and preview.
 */
@Injectable()
export class ConfiguratorService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async definition(slug: string, locale: CatalogLocale = 'en'): Promise<Configurator> {
    const { configurator, options, incompatibilities, text } = await this.load(slug, locale);
    const currency = configurator.currency as Currency;
    return {
      slug: configurator.slug,
      name: text.name,
      description: text.description,
      basePrice: money(configurator.basePriceAmount, currency),
      groups: CONFIGURATOR_GROUPS.map((key) => ({
        key,
        label: COPY[locale].groups[key],
        options: options
          .filter((option) => option.group === key)
          .map((option) => ({
            value: option.value,
            label: option.label,
            description: option.description,
            priceDelta: money(option.priceDeltaAmount, currency),
            available: option.available,
            swatch: option.swatch,
          })),
      })),
      incompatibilities: incompatibilities.map((rule) => ({
        a: { group: rule.groupA, value: rule.valueA },
        b: { group: rule.groupB, value: rule.valueB },
        reason: rule.reason,
      })),
      defaultSelection: Object.fromEntries(
        CONFIGURATOR_GROUPS.flatMap((group) => {
          const groupOptions = options.filter(
            (option) => option.group === group && option.available,
          );
          const option = groupOptions.find((o) => o.isDefault) ?? groupOptions[0];
          return option ? [[group, option.value]] : [];
        }),
      ),
    };
  }

  async quote(
    slug: string,
    selection: ConfigurationSelection,
    locale: CatalogLocale = 'en',
  ): Promise<ConfigurationQuote> {
    const { configurator, options, incompatibilities, text } = await this.load(slug, locale);
    const copy = COPY[locale];
    const details: { path: string; message: string }[] = [];
    const chosen = CONFIGURATOR_GROUPS.map((group) => {
      const value = selection[group];
      const option = options.find((o) => o.group === group && o.value === value);
      if (!value) details.push({ path: group, message: copy.choose(copy.groups[group]) });
      else if (!option) details.push({ path: group, message: copy.unknown(value) });
      else if (!option.available)
        details.push({ path: group, message: copy.unavailable(option.label) });
      return option;
    });
    for (const rule of incompatibilities) {
      if (selection[rule.groupA] === rule.valueA && selection[rule.groupB] === rule.valueB) {
        details.push({ path: `${rule.groupA}+${rule.groupB}`, message: rule.reason });
      }
    }
    if (details.length > 0) {
      throw new DomainError(
        ErrorCode.INVALID_CONFIGURATION,
        'This combination is not available',
        details,
      );
    }

    const picked = chosen.filter((option) => option !== undefined);
    const currency = configurator.currency as Currency;
    const total =
      configurator.basePriceAmount +
      picked.reduce((sum, option) => sum + option.priceDeltaAmount, 0);
    const preview = picked.reduce(
      (acc, option) => ({ ...acc, ...option.preview }),
      configurator.basePreview,
    );
    const normalised = Object.fromEntries(
      picked.map((option) => [option.group, option.value]),
    ) as ConfigurationSelection;
    return {
      configurationId: configurationId(configurator.slug, normalised),
      sku: [configurator.skuPrefix, ...picked.map((option) => option.skuCode)].join('-'),
      selection: normalised,
      price: money(total, currency),
      breakdown: [
        {
          group: null,
          label: copy.base(text.name),
          amount: money(configurator.basePriceAmount, currency),
        },
        ...picked
          .filter((option) => option.priceDeltaAmount > 0)
          .map((option) => ({
            group: option.group,
            label: option.label,
            amount: money(option.priceDeltaAmount, currency),
          })),
      ],
      preview,
    };
  }

  /** The configurator with its texts (option labels, rule reasons) in the requested language. */
  private async load(slug: string, locale: CatalogLocale) {
    const [configurator] = await this.db
      .select()
      .from(configurators)
      .where(and(eq(configurators.slug, slug), eq(configurators.active, true)));
    if (!configurator) throw new DomainError(ErrorCode.NOT_FOUND, 'Configurator not found');
    const [options, incompatibilities] = await Promise.all([
      this.db
        .select()
        .from(configuratorOptions)
        .where(eq(configuratorOptions.configuratorId, configurator.id))
        .orderBy(asc(configuratorOptions.position)),
      this.db
        .select()
        .from(configuratorIncompatibilities)
        .where(eq(configuratorIncompatibilities.configuratorId, configurator.id)),
    ]);
    const t = translationFor(configurator.translations, locale);
    return {
      configurator,
      text: {
        name: t?.name ?? configurator.name,
        description: t?.description ?? configurator.description,
      },
      options: options.map((option) => {
        const translated = t?.options?.[`${option.group}:${option.value}`];
        return {
          ...option,
          label: translated?.label ?? option.label,
          description: translated?.description ?? option.description,
        };
      }),
      incompatibilities: incompatibilities.map((rule) => ({
        ...rule,
        reason:
          t?.reasons?.[`${rule.groupA}:${rule.valueA}+${rule.groupB}:${rule.valueB}`] ??
          rule.reason,
      })),
    };
  }
}
