'use client';

import {
  ReviewInputSchema,
  type ProductReview,
  type RatingSummary,
  type ReviewSort,
} from '@market/types';
import { BadgeCheckIcon, FlagIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState, type SubmitEvent } from 'react';
import { FormField } from '@/components/auth/form-field';
import { Rating } from '@/components/product/rating';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/lib/api/errors';
import {
  useDeleteReview,
  useMyReview,
  useReportReview,
  useReviews,
  useSaveReview,
  useVoteReview,
  type ReviewFilters,
} from '@/lib/api/reviews';
import { useSession } from '@/lib/api/session';
import { fieldErrors, type FieldErrors } from '@/lib/auth/validation';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'helpful', label: 'Most helpful' },
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
];

/**
 * Reviews of one product. Everything shown (averages, counts, the verified badge)
 * comes from review-service; the page only sends ratings, text and votes.
 */
export function ReviewsSection({ productId }: { productId: string }) {
  const session = useSession();
  const signedIn = Boolean(session.data);
  const [filters, setFilters] = useState<ReviewFilters>({
    sort: 'helpful',
    rating: null,
    verified: false,
    page: 1,
  });
  const reviews = useReviews(productId, filters);
  const update = (patch: Partial<ReviewFilters>) => {
    setFilters((current) => ({ ...current, page: 1, ...patch }));
  };

  if (reviews.isPending) return <Skeleton className="h-64" aria-label="Loading reviews" />;
  if (reviews.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {userMessage(reviews.error)}
      </p>
    );
  }
  const { summary, items, totalPages } = reviews.data;

  return (
    <div className="grid gap-10 lg:grid-cols-[20rem_1fr]">
      <aside className="grid h-fit gap-6">
        <Summary
          summary={summary}
          selected={filters.rating}
          onSelect={(rating) => {
            update({ rating: filters.rating === rating ? null : rating });
          }}
        />
        <WriteReview productId={productId} signedIn={signedIn} loading={session.isPending} />
      </aside>

      <div className="grid h-fit gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <select
              value={filters.sort}
              onChange={(e) => {
                update({ sort: e.target.value as ReviewSort });
              }}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.verified}
              onChange={(e) => {
                update({ verified: e.target.checked });
              }}
            />
            Verified purchases only
          </label>
          {filters.rating && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                update({ rating: null });
              }}
            >
              Showing {filters.rating}★ — clear
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {summary.count === 0
              ? 'No reviews yet. Be the first to tell others how it types.'
              : 'No reviews match these filters.'}
          </p>
        ) : (
          <ul className="divide-y border-y" aria-busy={reviews.isFetching}>
            {items.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                productId={productId}
                signedIn={signedIn}
              />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav aria-label="Review pages" className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              disabled={filters.page <= 1}
              onClick={() => {
                setFilters((f) => ({ ...f, page: f.page - 1 }));
              }}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {filters.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={filters.page >= totalPages}
              onClick={() => {
                setFilters((f) => ({ ...f, page: f.page + 1 }));
              }}
            >
              Next
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}

function Summary({
  summary,
  selected,
  onSelect,
}: {
  summary: RatingSummary;
  selected: number | null;
  onSelect: (rating: number) => void;
}) {
  return (
    <div className="rounded-3xl border p-6">
      <div className="flex items-end gap-3">
        <span className="text-5xl font-semibold tabular-nums">{summary.average.toFixed(1)}</span>
        <Rating value={summary.average} count={summary.count} size="md" className="mb-1.5" />
      </div>
      {summary.verifiedCount > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-success">
          <BadgeCheckIcon className="size-3.5" aria-hidden="true" /> {summary.verifiedCount} from
          verified buyers
        </p>
      )}
      <ul className="mt-5 grid gap-1.5" aria-label="Rating distribution">
        {([5, 4, 3, 2, 1] as const).map((stars) => {
          const n = summary.distribution[stars];
          const share = summary.count === 0 ? 0 : (n / summary.count) * 100;
          return (
            <li key={stars}>
              <button
                type="button"
                disabled={n === 0}
                aria-pressed={selected === stars}
                onClick={() => {
                  onSelect(stars);
                }}
                className={cn(
                  'grid w-full grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 rounded-md px-1 py-0.5 text-xs disabled:opacity-60',
                  selected === stars && 'bg-accent',
                )}
              >
                <span className="flex items-center gap-0.5 tabular-nums">
                  {stars} <StarIcon className="size-3 fill-current" aria-hidden="true" />
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-border">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${String(share)}%` }}
                  />
                </span>
                <span className="text-right text-muted-foreground tabular-nums">{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewItem({
  review,
  productId,
  signedIn,
}: {
  review: ProductReview;
  productId: string;
  signedIn: boolean;
}) {
  const vote = useVoteReview(productId);
  const report = useReportReview(productId);
  const [reported, setReported] = useState(false);
  const cast = (value: 'helpful' | 'not_helpful') => {
    vote.mutate({ id: review.id, vote: review.myVote === value ? null : value });
  };
  return (
    <li className="grid gap-2 py-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Rating value={review.rating} />
        <h3 className="font-medium">{review.title}</h3>
      </div>
      <p className="text-sm whitespace-pre-line">{review.body}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{review.authorName}</span>
        {review.verifiedPurchase && (
          <span className="flex items-center gap-1 text-success">
            <BadgeCheckIcon className="size-3.5" aria-hidden="true" /> Verified purchase
          </span>
        )}
        <span>{formatDate(review.createdAt)}</span>
        {review.editedAt && <span>(edited)</span>}
      </p>
      {!review.mine && signedIn && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Helpful?</span>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={review.myVote === 'helpful'}
            disabled={vote.isPending}
            onClick={() => {
              cast('helpful');
            }}
          >
            <ThumbsUpIcon /> {review.helpfulCount}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={review.myVote === 'not_helpful'}
            disabled={vote.isPending}
            onClick={() => {
              cast('not_helpful');
            }}
          >
            <ThumbsDownIcon /> {review.notHelpfulCount}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={reported || report.isPending}
            onClick={() => {
              report.mutate(review.id, {
                onSuccess: () => {
                  setReported(true);
                },
              });
            }}
          >
            <FlagIcon /> {reported ? 'Reported' : 'Report'}
          </Button>
        </div>
      )}
      {!signedIn && review.helpfulCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {review.helpfulCount} {review.helpfulCount === 1 ? 'person' : 'people'} found this helpful
        </p>
      )}
      {(vote.isError || report.isError) && (
        <p role="alert" className="text-xs text-destructive">
          {userMessage(vote.error ?? report.error)}
        </p>
      )}
    </li>
  );
}

function WriteReview({
  productId,
  signedIn,
  loading,
}: {
  productId: string;
  signedIn: boolean;
  loading: boolean;
}) {
  const pathname = usePathname();
  const mine = useMyReview(productId, signedIn);
  const [editing, setEditing] = useState(false);
  const remove = useDeleteReview(productId);

  if (loading || (signedIn && mine.isPending)) return null;
  if (!signedIn) {
    return (
      <div className="rounded-3xl border p-6 text-sm">
        <p className="font-medium">Own this?</p>
        <p className="mt-1 text-muted-foreground">Sign in to share how it types.</p>
        <Button asChild className="mt-4 w-full">
          <Link href={`/login?next=${encodeURIComponent(`${pathname}#reviews`)}`} prefetch={false}>
            Sign in to review
          </Link>
        </Button>
      </div>
    );
  }
  const review = mine.data?.review ?? null;
  if (review && !editing) {
    return (
      <div className="rounded-3xl border p-6 text-sm">
        <p className="font-medium">Your review</p>
        <Rating value={review.rating} className="mt-2" />
        <p className="mt-1 font-medium">{review.title}</p>
        {review.status !== 'PUBLISHED' && (
          <p className="mt-2 text-xs text-muted-foreground">
            {review.status === 'PENDING'
              ? 'Waiting for a moderator before it is shown to others.'
              : 'Not published. Edit it to submit it again.'}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(review.id);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ReviewForm
      productId={productId}
      review={review}
      onDone={() => {
        setEditing(false);
      }}
    />
  );
}

function ReviewForm({
  productId,
  review,
  onDone,
}: {
  productId: string;
  review: ProductReview | null;
  onDone: () => void;
}) {
  const ratingLabel = useId();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useSaveReview(productId);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = ReviewInputSchema.safeParse({
      rating,
      title: data.get('title'),
      body: data.get('body'),
      authorName: data.get('authorName'),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate({ id: review?.id ?? null, input: parsed.data }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-3xl border p-6">
      <p className="font-medium">{review ? 'Edit your review' : 'Write a review'}</p>
      <div className="grid gap-2">
        <span id={ratingLabel} className="text-sm font-medium">
          Rating
        </span>
        <div role="radiogroup" aria-labelledby={ratingLabel} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              key={stars}
              type="button"
              role="radio"
              aria-checked={rating === stars}
              aria-label={`${String(stars)} star${stars === 1 ? '' : 's'}`}
              onClick={() => {
                setRating(stars);
              }}
              className="rounded-md p-0.5"
            >
              <StarIcon
                className={cn(
                  'size-6',
                  stars <= rating ? 'fill-brand text-brand' : 'text-muted-foreground',
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {errors.rating && <p className="text-xs text-destructive">{errors.rating}</p>}
      </div>
      <FormField
        label="Title"
        name="title"
        defaultValue={review?.title}
        maxLength={120}
        error={errors.title}
      />
      <div className="grid gap-2">
        <Label htmlFor={`${ratingLabel}-body`}>Your review</Label>
        <textarea
          id={`${ratingLabel}-body`}
          name="body"
          rows={5}
          maxLength={4_000}
          defaultValue={review?.body}
          aria-invalid={errors.body ? true : undefined}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive"
        />
        {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
      </div>
      <FormField
        label="Name shown with your review"
        name="authorName"
        defaultValue={review?.authorName}
        maxLength={40}
        hint="E.g. your first name and initial"
        error={errors.authorName}
      />
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {userMessage(save.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : review ? 'Save changes' : 'Post review'}
        </Button>
        {review && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
