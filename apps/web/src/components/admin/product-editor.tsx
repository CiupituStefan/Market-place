'use client';

import type { Availability, Variant } from '@market/types';
import { ExternalLinkIcon, ImageUpIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type SubmitEvent } from 'react';
import { FormField } from '@/components/auth/form-field';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAddVariant,
  useAdminProduct,
  useProductStatus,
  useRemoveImage,
  useRemoveVariant,
  useUpdateProduct,
  useUpdateVariant,
  useUploadImage,
  type ManagedProduct,
} from '@/lib/api/admin';
import { useSession } from '@/lib/api/session';
import { formatMoney } from '@/lib/format';
import {
  AdminPage,
  ErrorNote,
  formText,
  Panel,
  parseAmount,
  SelectField,
  TextAreaField,
  toAmountInput,
} from './admin-page';
import { DetailsFields, readDetails } from './product-fields';
import { AVAILABILITY_OPTIONS, ProductStatusBadge } from './products-view';

export function ProductEditor({ id }: { id: string }) {
  const product = useAdminProduct(id);
  const back = { href: '/admin/products', label: 'Products' };
  if (product.isPending) {
    return (
      <AdminPage title="Product" back={back}>
        <Skeleton className="h-96" />
      </AdminPage>
    );
  }
  if (product.isError) {
    return (
      <AdminPage title="Product" back={back}>
        <ErrorNote error={product.error} />
      </AdminPage>
    );
  }
  const p = product.data;
  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          {p.name} <ProductStatusBadge status={p.status} />
        </span>
      }
      description={`${p.brand} · ${String(p.variants.length)} variants · from ${formatMoney(p.price)}`}
      back={back}
      actions={<StatusActions product={p} />}
    >
      <div className="grid gap-6">
        <DetailsPanel product={p} />
        <VariantsPanel product={p} />
        <ImagesPanel product={p} />
        <AdvancedPanel product={p} />
      </div>
    </AdminPage>
  );
}

function StatusActions({ product }: { product: ManagedProduct }) {
  const status = useProductStatus(product.id);
  const session = useSession();
  const isAdmin = session.data?.roles.includes('ADMIN') ?? false;
  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {product.status === 'PUBLISHED' && (
          <Button variant="outline" asChild>
            <Link href={`/product/${product.slug}`} target="_blank">
              <ExternalLinkIcon /> View in store
            </Link>
          </Button>
        )}
        {product.status === 'PUBLISHED' ? (
          <Button
            variant="outline"
            disabled={status.isPending}
            onClick={() => {
              status.mutate('unpublish');
            }}
          >
            Unpublish
          </Button>
        ) : (
          <Button
            disabled={status.isPending}
            onClick={() => {
              status.mutate('publish');
            }}
          >
            Publish
          </Button>
        )}
        {isAdmin && product.status !== 'ARCHIVED' && (
          <Button
            variant="ghost"
            disabled={status.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Archive ${product.name}? It disappears from the store; order history keeps it.`,
                )
              ) {
                status.mutate('archive');
              }
            }}
          >
            Archive
          </Button>
        )}
      </div>
      <ErrorNote error={status.error} />
    </div>
  );
}

function DetailsPanel({ product }: { product: ManagedProduct }) {
  const update = useUpdateProduct(product.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const { details, errors: next } = readDetails(new FormData(event.currentTarget));
    setErrors(next);
    setSaved(false);
    if (Object.keys(next).length > 0) return;
    update.mutate(details as unknown as Record<string, unknown>, {
      onSuccess: () => {
        setSaved(true);
      },
    });
  }

  return (
    <Panel title="Details">
      <form onSubmit={submit} noValidate className="grid gap-4">
        <DetailsFields
          initial={{
            name: product.name,
            slug: product.slug,
            brand: product.brand,
            categorySlug: product.categorySlug,
            kind: product.kind,
            tagline: product.tagline,
            description: product.description,
            highlights: product.highlights,
            badges: product.badges,
            preview: product.preview,
          }}
          errors={errors}
        />
        <ErrorNote error={update.error} />
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span role="status" className="text-sm text-success">
              Saved
            </span>
          )}
          <Button type="submit" disabled={update.isPending}>
            Save details
          </Button>
        </div>
      </form>
    </Panel>
  );
}

const optionLabel = (product: ManagedProduct, variant: Variant) =>
  product.options
    .map(
      (o) =>
        o.values.find((v) => v.value === variant.options[o.key])?.label ?? variant.options[o.key],
    )
    .join(' / ');

function VariantsPanel({ product }: { product: ManagedProduct }) {
  const remove = useRemoveVariant(product.id);
  return (
    <Panel title="Variants and prices">
      <p className="mb-4 text-sm text-muted-foreground">
        Prices are what the server charges; the storefront only displays them. Stock is managed in
        Inventory.
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Variant
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Price (€)
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Compare at (€)
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Availability
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <VariantRow
                key={`${variant.id}-${String(variant.price.amount)}-${String(variant.compareAtPrice?.amount)}-${variant.availability}`}
                product={product}
                variant={variant}
                onRemove={
                  product.variants.length > 1
                    ? () => {
                        if (window.confirm(`Remove ${variant.sku}?`)) remove.mutate(variant.id);
                      }
                    : undefined
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <ErrorNote error={remove.error} />
      </div>
      <AddVariant product={product} />
    </Panel>
  );
}

function VariantRow({
  product,
  variant,
  onRemove,
}: {
  product: ManagedProduct;
  variant: Variant;
  onRemove: (() => void) | undefined;
}) {
  const update = useUpdateVariant(product.id);
  const [price, setPrice] = useState(toAmountInput(variant.price.amount));
  const [compareAt, setCompareAt] = useState(toAmountInput(variant.compareAtPrice?.amount));
  const [availability, setAvailability] = useState<Availability>(variant.availability);
  const [error, setError] = useState<string>();
  const dirty =
    price !== toAmountInput(variant.price.amount) ||
    compareAt !== toAmountInput(variant.compareAtPrice?.amount) ||
    availability !== variant.availability;

  function save() {
    const amount = parseAmount(price);
    const compare = compareAt.trim() ? parseAmount(compareAt) : null;
    if (!amount) {
      setError('Price like 149.00');
      return;
    }
    if (compareAt.trim() && (!compare || compare <= amount)) {
      setError('Compare-at must be higher than the price');
      return;
    }
    setError(undefined);
    update.mutate({
      variantId: variant.id,
      body: { price: amount, compareAtPrice: compare, availability },
    });
  }

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">
        <p className="font-medium">{optionLabel(product, variant) || 'Default'}</p>
        <p className="font-mono text-xs text-muted-foreground">{variant.sku}</p>
      </td>
      <td className="px-3 py-2">
        <Input
          aria-label={`Price of ${variant.sku}`}
          inputMode="decimal"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
          }}
          className="h-9 w-28 tabular-nums"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          aria-label={`Compare-at price of ${variant.sku}`}
          inputMode="decimal"
          placeholder="—"
          value={compareAt}
          onChange={(e) => {
            setCompareAt(e.target.value);
          }}
          className="h-9 w-28 tabular-nums"
        />
      </td>
      <td className="px-3 py-2">
        <SelectField
          label={`Availability of ${variant.sku}`}
          hideLabel
          value={availability}
          onChange={(e) => {
            setAvailability(e.target.value as Availability);
          }}
          options={AVAILABILITY_OPTIONS}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <Button size="sm" disabled={!dirty || update.isPending} onClick={save}>
            Save
          </Button>
          {onRemove && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove ${variant.sku}`}
              onClick={onRemove}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
        {(error ?? update.error) && (
          <p className="mt-1 max-w-48 text-xs text-destructive">{error ?? update.error?.message}</p>
        )}
      </td>
    </tr>
  );
}

function AddVariant({ product }: { product: ManagedProduct }) {
  const add = useAddVariant(product.id);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const sku = formText(data, 'sku').toUpperCase();
    const price = parseAmount(formText(data, 'price'));
    const next: Record<string, string> = {};
    if (!/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(sku))
      next.sku = '3–64 uppercase letters, digits or hyphens';
    if (!price) next.price = 'Price like 149.00';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const options = Object.fromEntries(
      product.options.map((o) => [o.key, formText(data, `option.${o.key}`)]),
    );
    add.mutate(
      { sku, options, price, availability: data.get('availability') },
      {
        onSuccess: () => {
          form.reset();
          setOpen(false);
        },
      },
    );
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          setOpen(true);
        }}
      >
        Add variant
      </Button>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-3 rounded-xl border p-4">
      <h3 className="text-sm font-semibold">New variant</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {product.options.map((o) => (
          <SelectField
            key={o.key}
            label={o.name}
            name={`option.${o.key}`}
            options={o.values.map((v) => ({ value: v.value, label: v.label }))}
          />
        ))}
        <FormField label="SKU" name="sku" error={errors.sku} className="font-mono uppercase" />
        <FormField label="Price (€)" name="price" inputMode="decimal" error={errors.price} />
        <SelectField label="Availability" name="availability" options={AVAILABILITY_OPTIONS} />
      </div>
      <p className="text-xs text-muted-foreground">Each combination of options can exist once.</p>
      <ErrorNote error={add.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={add.isPending}>
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ImagesPanel({ product }: { product: ManagedProduct }) {
  const upload = useUploadImage(product.id);
  const remove = useRemoveImage(product.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState(product.name);

  return (
    <Panel title="Images">
      {product.images.length === 0 ? (
        <div className="mb-4 grid max-w-xs gap-2">
          <ProductArt
            preview={product.preview}
            title={product.name}
            className="aspect-[4/3] rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            No photos yet: the store shows this generated preview.
          </p>
        </div>
      ) : (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {product.images.map((image) => (
            <li
              key={image.id ?? image.url}
              className="group relative overflow-hidden rounded-xl border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails from the CDN */}
              <img src={image.url} alt={image.alt} className="aspect-square w-full object-cover" />
              <Button
                size="icon"
                variant="outline"
                aria-label={`Delete image ${image.alt}`}
                className="absolute top-2 right-2"
                disabled={!image.id}
                onClick={() => {
                  if (image.id && window.confirm('Delete this image?')) remove.mutate(image.id);
                }}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <FormField
          label="Alt text (describe the photo)"
          value={alt}
          onChange={(e) => {
            setAlt(e.target.value);
          }}
        />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            aria-label="Choose image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate({ file, alt: alt.trim() || product.name, variantId: null });
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <ImageUpIcon /> {upload.isPending ? 'Uploading…' : 'Upload image'}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        JPEG, PNG, WebP or AVIF. Files go straight to object storage with a short-lived signed form.
      </p>
      <div className="mt-3 grid gap-2">
        <ErrorNote error={upload.error} />
        <ErrorNote error={remove.error} />
      </div>
    </Panel>
  );
}

/** Structured content edited as JSON (validated by the service with the same schema). */
function AdvancedPanel({ product }: { product: ManagedProduct }) {
  const update = useUpdateProduct(product.id);
  const initial = JSON.stringify(
    {
      specs: product.specs,
      attributes: product.attributes,
      included: product.included,
      compatibility: product.compatibility,
      faq: product.faq,
      options: product.options,
    },
    null,
    2,
  );
  const [text, setText] = useState(initial);
  const [parseError, setParseError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    try {
      const value = JSON.parse(text) as Record<string, unknown>;
      setParseError(undefined);
      update.mutate(value, {
        onSuccess: () => {
          setSaved(true);
        },
      });
    } catch (error) {
      setParseError(`Not valid JSON: ${(error as Error).message}`);
    }
  }

  return (
    <Panel title="Specifications, attributes and FAQ">
      <TextAreaField
        label="Structured content (JSON)"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        rows={16}
        spellCheck={false}
        className="font-mono text-xs"
        hint="Attributes drive the shop filters (layout, switch type…). Options must still match every variant."
        error={parseError}
      />
      <div className="mt-3 grid gap-2">
        <ErrorNote error={update.error} />
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span role="status" className="text-sm text-success">
              Saved
            </span>
          )}
          <Button variant="outline" disabled={text === initial || update.isPending} onClick={save}>
            Save structured content
          </Button>
        </div>
      </div>
    </Panel>
  );
}
