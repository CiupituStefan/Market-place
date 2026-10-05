'use client';

import { useId, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { FILTER_KEYS, type CatalogQuery, type FilterKey } from '@/lib/catalog/query';
import type { Facet } from '@/lib/catalog/schemas';
import { useCatalogNavigation } from './use-catalog-navigation';

interface FiltersProps {
  query: CatalogQuery;
  facets: Facet[];
}

function isFilterKey(key: string): key is FilterKey {
  return FILTER_KEYS.some((f) => f.key === key);
}

export function Filters({ query, facets }: FiltersProps) {
  const { navigate, isPending } = useCatalogNavigation(query);
  const baseId = useId();
  const [minPrice, setMinPrice] = useState(query.minPrice?.toString() ?? '');
  const [maxPrice, setMaxPrice] = useState(query.maxPrice?.toString() ?? '');

  function toggle(key: FilterKey, value: string, checked: boolean) {
    const current = query[key];
    navigate({ [key]: checked ? [...current, value] : current.filter((v) => v !== value) });
  }

  function applyPrice(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const toNumber = (value: string) => {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    navigate({ minPrice: toNumber(minPrice), maxPrice: toNumber(maxPrice) });
  }

  return (
    <div
      aria-busy={isPending}
      className="flex flex-col gap-6 transition-opacity aria-busy:opacity-60"
    >
      <div className="flex items-center gap-2.5">
        <Checkbox
          id={`${baseId}-instock`}
          checked={query.inStock}
          onCheckedChange={(checked) => {
            navigate({ inStock: checked === true });
          }}
        />
        <Label htmlFor={`${baseId}-instock`}>In stock only</Label>
      </div>

      {facets.map((facet) => {
        const key = facet.key;
        if (!isFilterKey(key)) return null;
        return (
          <fieldset key={key}>
            <Separator className="mb-6" />
            <legend className="mb-3 text-sm font-semibold">{facet.label}</legend>
            <ul className="flex flex-col gap-2.5">
              {facet.values.map(({ value, count }) => {
                const id = `${baseId}-${key}-${value}`;
                const checked = query[key].includes(value);
                return (
                  <li key={value} className="flex items-center gap-2.5">
                    <Checkbox
                      id={id}
                      checked={checked}
                      disabled={count === 0 && !checked}
                      onCheckedChange={(state) => {
                        toggle(key, value, state === true);
                      }}
                    />
                    <Label htmlFor={id} className="flex-1 justify-between font-normal">
                      {value}
                      <span className="font-mono text-xs text-muted-foreground">{count}</span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      <form onSubmit={applyPrice}>
        <Separator className="mb-6" />
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Price (€)</legend>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Minimum price"
              inputMode="numeric"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value.replace(/\D/g, ''));
              }}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              aria-label="Maximum price"
              inputMode="numeric"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value.replace(/\D/g, ''));
              }}
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="mt-3 w-full">
            Apply price
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
