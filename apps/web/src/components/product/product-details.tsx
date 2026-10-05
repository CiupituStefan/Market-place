import { CheckIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Product } from '@/lib/catalog/schemas';

export function ProductDetails({ product }: { product: Product }) {
  return (
    <Tabs defaultValue="description">
      <TabsList aria-label="Product information">
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="specs">Specifications</TabsTrigger>
        <TabsTrigger value="included">What’s included</TabsTrigger>
        <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
        <TabsTrigger value="shipping">Shipping</TabsTrigger>
      </TabsList>

      {/* forceMount keeps every tab in the HTML for search engines and no-JS users. */}
      <TabsContent value="description" forceMount className="data-[state=inactive]:hidden">
        <div className="max-w-3xl space-y-4 text-pretty text-muted-foreground">
          {product.description.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="specs" forceMount className="data-[state=inactive]:hidden">
        <div className="grid gap-10 md:grid-cols-2">
          {product.specs.map((group) => (
            <div key={group.group}>
              <h3 className="eyebrow text-muted-foreground">{group.group}</h3>
              <dl className="mt-4 divide-y border-y">
                {group.items.map((item) => (
                  <div key={item.label} className="grid grid-cols-[10rem_1fr] gap-4 py-3 text-sm">
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
            <h3 className="font-medium text-foreground">Shipping</h3>
            <p className="mt-2">
              Orders placed before 14:00 CET ship the same business day. Free tracked EU shipping
              over €99; express options are shown at checkout.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Returns & warranty</h3>
            <p className="mt-2">
              30-day returns on unused items in original packaging. Every keyboard is covered by a
              2-year warranty.
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
