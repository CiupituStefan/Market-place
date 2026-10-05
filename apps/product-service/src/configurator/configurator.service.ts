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

const GROUP_LABELS: Record<ConfiguratorGroup, string> = {
  layout: 'Layout',
  case: 'Case',
  switch: 'Switches',
  plate: 'Plate',
  keycaps: 'Keycaps',
  connection: 'Connection',
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

  async definition(slug: string): Promise<Configurator> {
    const { configurator, options, incompatibilities } = await this.load(slug);
    const currency = configurator.currency as Currency;
    return {
      slug: configurator.slug,
      name: configurator.name,
      description: configurator.description,
      basePrice: money(configurator.basePriceAmount, currency),
      groups: CONFIGURATOR_GROUPS.map((key) => ({
        key,
        label: GROUP_LABELS[key],
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

  async quote(slug: string, selection: ConfigurationSelection): Promise<ConfigurationQuote> {
    const { configurator, options, incompatibilities } = await this.load(slug);
    const details: { path: string; message: string }[] = [];
    const chosen = CONFIGURATOR_GROUPS.map((group) => {
      const value = selection[group];
      const option = options.find((o) => o.group === group && o.value === value);
      if (!value)
        details.push({ path: group, message: `Choose a ${GROUP_LABELS[group].toLowerCase()}` });
      else if (!option) details.push({ path: group, message: `Unknown option "${value}"` });
      else if (!option.available)
        details.push({ path: group, message: `${option.label} is currently unavailable` });
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
          label: `${configurator.name} base`,
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

  private async load(slug: string) {
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
    return { configurator, options, incompatibilities };
  }
}
