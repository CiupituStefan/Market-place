import { CheckIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Product } from '@/lib/catalog/schemas';
import { getI18n } from '@/lib/i18n/server';

export async function ProductDetails({ product }: { product: Product }) {
  const { t } = await getI18n();
  const copy = t.product;
  return (
    <Tabs defaultValue="description">
      <TabsList aria-label={copy.tabs.label}>
        <TabsTrigger value="description">{copy.tabs.description}</TabsTrigger>
        <TabsTrigger value="specs">{copy.tabs.specs}</TabsTrigger>
        <TabsTrigger value="included">{copy.tabs.included}</TabsTrigger>
        <TabsTrigger value="compatibility">{copy.tabs.compatibility}</TabsTrigger>
        <TabsTrigger value="shipping">{copy.tabs.shipping}</TabsTrigger>
      </TabsList>

      {/* forceMount keeps every tab in the HTML for search engines and no-JS users. */}
      <TabsContent value="description" forceMount className="data-[state=inactive]:hidden">
        <div className="max-w-3xl space-y-4 text-lg leading-relaxed text-pretty">
          {product.description.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="specs" forceMount className="data-[state=inactive]:hidden">
        <div className="grid gap-10 md:grid-cols-2">
          {product.specs.map((group) => (
            <div key={group.group}>
              <h3 className="text-xl font-semibold tracking-tight">{group.group}</h3>
              <dl className="mt-4 divide-y border-t-2 border-t-foreground">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[minmax(7rem,12rem)_1fr] gap-4 py-3 text-base"
                  >
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="included" forceMount className="data-[state=inactive]:hidden">
        <ul className="grid max-w-xl gap-3 text-sm">
          {product.included.map((item) => (
            <li key={item} className="flex gap-3">
              <CheckIcon className="size-4 shrink-0 text-brand" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="compatibility" forceMount className="data-[state=inactive]:hidden">
        <ul className="grid max-w-xl gap-3 text-sm">
          {product.compatibility.map((item) => (
            <li key={item} className="flex gap-3">
              <CheckIcon className="size-4 shrink-0 text-brand" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="shipping" forceMount className="data-[state=inactive]:hidden">
        <div className="grid max-w-3xl gap-6 text-sm text-muted-foreground md:grid-cols-2">
          <div>
            <h3 className="font-medium text-foreground">{copy.shippingTitle}</h3>
            <p className="mt-2">{copy.shippingBody}</p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">{copy.returnsTitle}</h3>
            <p className="mt-2">{copy.returnsBody}</p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
