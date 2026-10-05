'use client';

import type { Product } from '@/lib/catalog/schemas';
import { valueAvailability, type Selection } from '@/lib/catalog/variants';
import { cn } from '@/lib/utils';

interface VariantPickerProps {
  product: Product;
  selection: Selection;
  onSelect: (optionKey: string, value: string) => void;
}

export function VariantPicker({ product, selection, onSelect }: VariantPickerProps) {
  return (
    <div className="flex flex-col gap-6">
      {product.options.map((option) => {
        const selected = option.values.find((v) => v.value === selection[option.key]);
        return (
          <fieldset key={option.key}>
            <legend className="mb-3 text-sm">
              <span className="font-medium">{option.name}:</span>{' '}
              <span className="text-muted-foreground">{selected?.label}</span>
            </legend>
            <div role="group" aria-label={option.name} className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const availability = valueAvailability(product, selection, option.key, value.value);
                const unavailable =
                  availability === 'UNAVAILABLE' || availability === 'OUT_OF_STOCK';
                const isSelected = selection[option.key] === value.value;
                const label = `${value.label}${unavailable ? ' (unavailable in this combination)' : ''}`;
                return option.display === 'swatch' ? (
                  <button
                    key={value.value}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={label}
                    title={value.label}
                    onClick={() => {
                      onSelect(option.key, value.value);
                    }}
                    className={cn(
                      'relative size-10 rounded-full border ring-offset-2 ring-offset-background transition',
                      isSelected ? 'ring-2 ring-foreground' : 'hover:scale-105',
                      unavailable &&
                        'opacity-50 after:absolute after:inset-0 after:m-auto after:h-px after:w-[120%] after:-translate-x-[8%] after:rotate-45 after:bg-foreground/60',
                    )}
                    style={{ backgroundColor: value.swatch }}
                  />
                ) : (
                  <button
                    key={value.value}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={label}
                    onClick={() => {
                      onSelect(option.key, value.value);
                    }}
                    className={cn(
                      'flex min-w-24 flex-col items-start rounded-xl border px-4 py-2.5 text-left transition',
                      isSelected ? 'border-foreground bg-accent' : 'hover:border-foreground/40',
                      unavailable && 'text-muted-foreground line-through decoration-foreground/40',
                    )}
                  >
                    <span className="text-sm font-medium">{value.label}</span>
                    {value.hint && (
                      <span className="text-xs text-muted-foreground no-underline">
                        {value.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
