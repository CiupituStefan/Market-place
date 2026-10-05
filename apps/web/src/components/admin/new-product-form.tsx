'use client';

import type { Availability } from '@market/types';
import { PlusIcon, Trash2Icon, WandSparklesIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProduct } from '@/lib/api/admin';
import { ErrorNote, Panel, parseAmount, SelectField } from './admin-page';
import { DetailsFields, readDetails, slugify } from './product-fields';

interface OptionDraft {
  name: string;
  display: 'pill' | 'swatch';
  /** Comma-separated labels, e.g. "Linear, Tactile". */
  values: string;
}

interface VariantDraft {
  sku: string;
  options: Record<string, string>;
  price: string;
  availability: Availability;
}

const optionKey = (name: string) => {
  const words = slugify(name).split('-').filter(Boolean);
  const key = words.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  return /^[a-z]/.test(key) ? key.slice(0, 31) : `o${key}`.slice(0, 31);
};
const valuesOf = (option: OptionDraft) =>
  option.values
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((label) => ({ label, value: slugify(label).slice(0, 40) }));

/** Every combination of option values (cartesian product). */
function combinations(options: OptionDraft[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, option) =>
      acc.flatMap((combo) =>
        valuesOf(option).map((v) => ({ ...combo, [optionKey(option.name)]: v.value })),
      ),
    [{}],
  );
}

export function NewProductForm() {
  const router = useRouter();
  const create = useCreateProduct();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<OptionDraft[]>([
    { name: 'Color', display: 'swatch', values: 'Carbon, Chalk' },
    { name: 'Switch', display: 'pill', values: 'Linear, Tactile' },
  ]);
  const [skuPrefix, setSkuPrefix] = useState('CSE-NEW');
  const [basePrice, setBasePrice] = useState('149.00');
  const [variants, setVariants] = useState<VariantDraft[]>([]);

  function generate() {
    const prefix = skuPrefix.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setVariants(
      combinations(options).map((combo) => ({
        sku: [prefix, ...Object.values(combo).map((v) => v.toUpperCase().slice(0, 8))].join('-'),
        options: combo,
        price: basePrice,
        availability: 'IN_STOCK',
      })),
    );
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const { details, errors: next } = readDetails(new FormData(event.currentTarget));
    if (variants.length === 0) next.variants = 'Generate or add at least one variant';
    const parsed = variants.map((v) => ({ ...v, amount: parseAmount(v.price) }));
    if (parsed.some((v) => v.amount === null || v.amount === 0))
      next.variants = 'Every variant needs a price like 149.00';
    if (parsed.some((v) => !/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(v.sku)))
      next.variants = 'SKUs: 3–64 uppercase letters, digits or hyphens';
    if (new Set(parsed.map((v) => v.sku)).size !== parsed.length)
      next.variants = 'SKUs must be unique';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    create.mutate(
      {
        ...details,
        options: options.map((o) => ({
          key: optionKey(o.name),
          name: o.name.trim(),
          display: o.display,
          values: valuesOf(o),
        })),
        variants: parsed.map((v) => ({
          sku: v.sku,
          options: v.options,
          price: v.amount,
          availability: v.availability,
        })),
      },
      {
        onSuccess: ({ id }) => {
          router.push(`/admin/products/${id}`);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Panel title="Details">
        <DetailsFields errors={errors} />
      </Panel>

      <Panel title="Options">
        <p className="mb-4 text-sm text-muted-foreground">
          What a customer chooses (colour, switch, layout…). Every combination becomes a variant
          with its own SKU, price and stock.
        </p>
        <div className="grid gap-3">
          {options.map((option, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_2fr_auto] sm:items-end">
              <OptionInput
                label="Option"
                value={option.name}
                onChange={(name) => {
                  setOptions(options.map((o, j) => (j === i ? { ...o, name } : o)));
                }}
              />
              <SelectField
                label="Shown as"
                value={option.display}
                onChange={(e) => {
                  setOptions(
                    options.map((o, j) =>
                      j === i ? { ...o, display: e.target.value as OptionDraft['display'] } : o,
                    ),
                  );
                }}
                options={[
                  { value: 'pill', label: 'Pills' },
                  { value: 'swatch', label: 'Swatches' },
                ]}
              />
              <OptionInput
                label="Values (comma-separated)"
                value={option.values}
                onChange={(values) => {
                  setOptions(options.map((o, j) => (j === i ? { ...o, values } : o)));
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove option ${option.name}`}
                onClick={() => {
                  setOptions(options.filter((_, j) => j !== i));
                }}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={options.length >= 5}
              onClick={() => {
                setOptions([...options, { name: '', display: 'pill', values: '' }]);
              }}
            >
              <PlusIcon /> Add option
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Variants">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <OptionInput label="SKU prefix" value={skuPrefix} onChange={setSkuPrefix} />
          <OptionInput
            label="Price for all (€)"
            value={basePrice}
            onChange={setBasePrice}
            inputMode="decimal"
          />
          <Button type="button" variant="outline" onClick={generate}>
            <WandSparklesIcon /> Generate {String(combinations(options).length)} variants
          </Button>
        </div>
        {variants.length > 0 && (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Options
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    SKU
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Price (€)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">
                      {Object.values(variant.options).join(' / ') || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="SKU"
                        value={variant.sku}
                        onChange={(e) => {
                          setVariants(
                            variants.map((v, j) =>
                              j === i ? { ...v, sku: e.target.value.toUpperCase() } : v,
                            ),
                          );
                        }}
                        className="h-9 font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Price"
                        inputMode="decimal"
                        value={variant.price}
                        onChange={(e) => {
                          setVariants(
                            variants.map((v, j) => (j === i ? { ...v, price: e.target.value } : v)),
                          );
                        }}
                        className="h-9 w-28 tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove variant"
                        onClick={() => {
                          setVariants(variants.filter((_, j) => j !== i));
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {errors.variants && <p className="mt-3 text-sm text-destructive">{errors.variants}</p>}
      </Panel>

      <ErrorNote error={create.error} />
      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create as draft'}
        </Button>
      </div>
    </form>
  );
}

function OptionInput({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: 'decimal';
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input
        value={value}
        inputMode={inputMode}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </label>
  );
}
