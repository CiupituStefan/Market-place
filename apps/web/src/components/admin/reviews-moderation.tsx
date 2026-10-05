'use client';

import { REVIEW_STATUSES, type ReviewStatus } from '@market/types';
import { FlagIcon, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useModerateReview, useModerationQueue, type ModeratedReview } from '@/lib/api/admin';
import { formatDateTime } from '@/lib/format';
import { ErrorNote, Pagination, SelectField, Toolbar } from './admin-page';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'Waiting for moderation',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
};

/** Moderation queue, or one customer's reviews (customer detail). */
export function ReviewList({ userId }: { userId?: string }) {
  const [status, setStatus] = useState<ReviewStatus | ''>(userId ? '' : 'PENDING');
  const [page, setPage] = useState(1);
  const queue = useModerationQueue({ status: status || undefined, userId, page });

  return (
    <>
      <Toolbar>
        <SelectField
          label="Status"
          hideLabel
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ReviewStatus | '');
            setPage(1);
          }}
          options={[
            ...(userId ? [{ value: '', label: 'All statuses' }] : []),
            ...REVIEW_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]}
        />
      </Toolbar>
      {queue.isPending ? (
        <Skeleton className="h-40" />
      ) : queue.isError ? (
        <ErrorNote error={queue.error} />
      ) : queue.data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {status === 'PENDING' ? 'Nothing waiting for moderation.' : 'No reviews here.'}
        </p>
      ) : (
        <ul className="grid gap-4">
          {queue.data.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}
      {queue.data && (
        <Pagination
          page={page}
          pageSize={queue.data.pageSize}
          total={queue.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}

function ReviewCard({ review }: { review: ModeratedReview }) {
  const moderate = useModerateReview();
  const act = (status: ReviewStatus) => {
    const note =
      status === 'REJECTED'
        ? window.prompt('Reason (shown to staff only)', review.moderationNote ?? '')
        : null;
    if (status === 'REJECTED' && note === null) return;
    moderate.mutate({ id: review.id, status, note: note?.trim() ? note.trim() : null });
  };
  return (
    <li className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className="flex items-center gap-0.5"
          aria-label={`${String(review.rating)} of 5 stars`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <StarIcon
              key={i}
              className={
                i < review.rating
                  ? 'size-4 fill-brand text-brand'
                  : 'size-4 text-muted-foreground/40'
              }
              aria-hidden="true"
            />
          ))}
        </span>
        <span className="font-semibold">{review.title}</span>
        <Badge
          variant={
            review.status === 'REJECTED'
              ? 'destructive'
              : review.status === 'PENDING'
                ? 'soft'
                : 'outline'
          }
        >
          {STATUS_LABELS[review.status]}
        </Badge>
        {review.verifiedPurchase && <Badge variant="outline">Verified purchase</Badge>}
        {review.reportCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <FlagIcon className="size-3.5" aria-hidden="true" /> {review.reportCount} reports
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{review.body}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        {review.authorName} · {formatDateTime(review.createdAt)} ·{' '}
        <Link href={`/admin/products/${review.productId}`} className="underline">
          product
        </Link>
        {review.moderationNote && <> · Note: {review.moderationNote}</>}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {review.status !== 'PUBLISHED' && (
          <Button
            size="sm"
            disabled={moderate.isPending}
            onClick={() => {
              act('PUBLISHED');
            }}
          >
            Publish
          </Button>
        )}
        {review.status !== 'REJECTED' && (
          <Button
            size="sm"
            variant="outline"
            disabled={moderate.isPending}
            onClick={() => {
              act('REJECTED');
            }}
          >
            Reject
          </Button>
        )}
        {review.status === 'PUBLISHED' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={moderate.isPending}
            onClick={() => {
              act('PENDING');
            }}
          >
            Hold for review
          </Button>
        )}
      </div>
      <div className="mt-2">
        <ErrorNote error={moderate.error} />
      </div>
    </li>
  );
}
