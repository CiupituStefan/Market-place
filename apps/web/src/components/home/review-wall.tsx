import { BadgeCheckIcon } from 'lucide-react';
import { Rating } from '@/components/product/rating';
import type { Review } from '@/lib/catalog/schemas';

export function ReviewWall({ reviews }: { reviews: Review[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {reviews.map((review) => (
        <li key={review.id} className="flex flex-col rounded-2xl border bg-card p-6">
          <Rating value={review.rating} />
          <h3 className="mt-4 font-medium">{review.title}</h3>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">“{review.body}”</p>
          <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs">
            <span className="font-medium">{review.author}</span>
            <span className="text-muted-foreground">{review.productName}</span>
          </div>
          {review.verifiedPurchase && (
            <p className="mt-2 flex items-center gap-1 text-xs text-success">
              <BadgeCheckIcon className="size-3.5" aria-hidden="true" /> Verified purchase
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
