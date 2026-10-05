'use client';

import { useMutation } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { addConfigurationToCart, quoteConfiguration } from '@/lib/api/configurator';
import { ApiError, userMessage } from '@/lib/api/errors';
import type {
  ConfigurationQuote,
  ConfigurationSelection,
  Configurator,
  ConfiguratorGroup,
} from '@/lib/catalog/schemas';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ConfiguratorBuilderProps {
  configurator: Configurator;
  initialQuote: ConfigurationQuote;
}

/** Client-side hint only: the server re-validates every selection when quoting. */
function conflictsWith(
  configurator: Configurator,
  selection: ConfigurationSelection,
  group: ConfiguratorGroup,
  value: string,
) {
  return configurator.incompatibilities.find(
    (rule) =>
      (rule.a.group === group &&
        rule.a.value === value &&
        selection[rule.b.group] === rule.b.value) ||
      (rule.b.group === group &&
        rule.b.value === value &&
        selection[rule.a.group] === rule.a.value),
  );
}

export function ConfiguratorBuilder({ configurator, initialQuote }: ConfiguratorBuilderProps) {
  const [selection, setSelection] = useState<ConfigurationSelection>(initialQuote.selection);
  const [quote, setQuote] = useState<ConfigurationQuote>(initialQuote);

  const quoting = useMutation({
    mutationFn: (next: ConfigurationSelection) => quoteConfiguration(configurator.slug, next),
    onSuccess: setQuote,
  });
  const addToCart = useMutation({
    mutationFn: () => addConfigurationToCart(configurator.slug, selection),
  });

  function choose(group: ConfiguratorGroup, value: string) {
    const next = { ...selection, [group]: value };
    setSelection(next);
    addToCart.reset();
    quoting.mutate(next);
  }

  const invalid = quoting.isError;
  const problems = quoting.error instanceof ApiError ? (quoting.error.details ?? []) : [];

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="flex aspect-[5/4] items-center justify-center rounded-3xl bg-stage p-8 md:p-14">
          <ProductArt
            preview={quote.preview}
            quality="full"
            title={`${configurator.name} preview`}
            className={cn(
              'w-full transition-opacity duration-300',
              quoting.isPending && 'opacity-70',
            )}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border p-5 text-sm">
          <div>
            <dt className="text-muted-foreground">SKU</dt>
            <dd className="mt-1 font-mono text-xs break-all">{quote.sku}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Configuration ID</dt>
            <dd className="mt-1 font-mono text-xs">{quote.configurationId}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-8">
        {configurator.groups.map((group) => (
          <fieldset key={group.key}>
            <legend className="mb-3 text-sm font-semibold">{group.label}</legend>
            <div
              role="group"
              aria-label={group.label}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {group.options.map((option) => {
                const selected = selection[group.key] === option.value;
                const conflict = conflictsWith(configurator, selection, group.key, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={!option.available}
                    title={conflict?.reason}
                    onClick={() => {
                      choose(group.key, option.value);
                    }}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left transition',
                      selected ? 'border-foreground bg-accent' : 'hover:border-foreground/40',
                      conflict && !selected && 'border-dashed opacity-60',
                      !option.available && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {option.swatch && (
                        <span
                          className="size-3.5 rounded-full border"
                          style={{ backgroundColor: option.swatch }}
                          aria-hidden="true"
                        />
                      )}
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    )}
                    <span className="font-mono text-[0.7rem] text-muted-foreground">
                      {option.priceDelta.amount > 0
                        ? `+${formatMoney(option.priceDelta)}`
                        : 'Included'}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="rounded-3xl border bg-card p-6" aria-live="polite">
          {invalid ? (
            <div role="alert" className="text-sm text-destructive">
              <p className="font-medium">{userMessage(quoting.error)}</p>
              <ul className="mt-2 list-disc pl-5">
                {problems.map((problem) => (
                  <li key={problem.path}>{problem.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <ul className="grid gap-2 text-sm">
                {quote.breakdown.map((line) => (
                  <li
                    key={`${line.group ?? 'base'}-${line.label}`}
                    className="flex justify-between gap-4"
                  >
                    <span className="text-muted-foreground">{line.label}</span>
                    <span className="tabular-nums">{formatMoney(line.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-baseline justify-between border-t pt-4">
                <span className="font-medium">Total</span>
                <span className="text-3xl font-semibold tabular-nums">
                  {formatMoney(quote.price)}
                </span>
              </p>
            </>
          )}
          <Button
            size="lg"
            className="mt-6 w-full"
            disabled={invalid || quoting.isPending || addToCart.isPending}
            onClick={() => {
              addToCart.mutate();
            }}
          >
            {addToCart.isSuccess ? (
              <>
                <CheckIcon /> Added to cart
              </>
            ) : (
              'Add to cart'
            )}
          </Button>
          {addToCart.isError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {userMessage(addToCart.error)}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Assembled and sound-tested in 5–7 business days.
          </p>
        </div>
      </div>
    </div>
  );
}
