import { enqueueEvent, isUniqueViolation } from '@market/db';
import { ProductRatingChangedV1, ReviewCreatedV1 } from '@market/events';
import {
  DomainError,
  ErrorCode,
  paginate,
  toOffset,
  type AuthUser,
  type Paginated,
  type PaginationQuery,
  type ProductReview,
  type RatingSummary,
  type ReviewInput,
  type ReviewPage,
  type ReviewSort,
  type ReviewStatus,
} from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { CATALOG, type CatalogGateway } from '../clients/catalog.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { purchases, reviewReports, reviews, reviewVotes, type ReviewRow } from '../db/schema.js';
import { autoModerate } from './moderation.js';

export interface ListOptions extends PaginationQuery {
  sort: ReviewSort;
  rating?: number;
  verifiedOnly: boolean;
}

const notFound = () => new DomainError(ErrorCode.NOT_FOUND, 'Review not found');

@Injectable()
export class ReviewService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CATALOG) private readonly catalog: CatalogGateway,
  ) {}

  // ── reading ────────────────────────────────────────────────────────────────

  /** Published reviews of a product with its rating summary. */
  async list(
    productId: string,
    options: ListOptions,
    viewerId: string | null,
  ): Promise<ReviewPage> {
    const conditions: SQL[] = [eq(reviews.productId, productId), eq(reviews.status, 'PUBLISHED')];
    if (options.rating) conditions.push(eq(reviews.rating, options.rating));
    if (options.verifiedOnly) conditions.push(eq(reviews.verifiedPurchase, true));
    const where = and(...conditions);
    const order = {
      newest: [desc(reviews.createdAt)],
      helpful: [
        desc(sql`${reviews.helpfulCount} - ${reviews.notHelpfulCount}`),
        desc(reviews.createdAt),
      ],
      highest: [desc(reviews.rating), desc(reviews.createdAt)],
      lowest: [asc(reviews.rating), desc(reviews.createdAt)],
    }[options.sort];
    const { offset, limit } = toOffset(options);
    const rows = await this.db
      .select()
      .from(reviews)
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset(offset);
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(reviews)
      .where(where);
    const page = paginate(await this.views(rows, viewerId), total, options);
    return { summary: await this.summary(productId), ...page };
  }

  async summary(productId: string, db: Database = this.db): Promise<RatingSummary> {
    const rows = await db
      .select({
        rating: reviews.rating,
        n: count(),
        verified: sql<number>`count(*) filter (where ${reviews.verifiedPurchase})`.mapWith(Number),
      })
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.status, 'PUBLISHED')))
      .groupBy(reviews.rating);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;
    let verified = 0;
    for (const row of rows) {
      distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row.n;
      total += row.n;
      sum += row.rating * row.n;
      verified += row.verified;
    }
    return {
      productId,
      average: total === 0 ? 0 : Math.round((sum / total) * 100) / 100,
      count: total,
      distribution,
      verifiedCount: verified,
    };
  }

  /** The viewer's own review of a product, whatever its status. */
  async mine(productId: string, userId: string): Promise<ProductReview | null> {
    const [row] = await this.db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.userId, userId)));
    return row ? ((await this.views([row], userId))[0] ?? null) : null;
  }

  // ── writing ────────────────────────────────────────────────────────────────

  async create(user: AuthUser, productId: string, input: ReviewInput): Promise<ProductReview> {
    if (!user.emailVerified) {
      throw new DomainError(
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Confirm your email address before writing a review',
      );
    }
    const [product] = await this.catalog.products([productId]);
    if (product?.status !== 'PUBLISHED') {
      throw new DomainError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found');
    }
    const moderation = autoModerate(input);
    const verified = await this.boughtIt(user.id, productId);
    try {
      const row = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(reviews)
          .values({
            productId,
            userId: user.id,
            ...input,
            status: moderation.status,
            moderationNote: moderation.note,
            verifiedPurchase: verified,
          })
          .returning();
        if (!created) throw new Error('insert returned nothing');
        await enqueueEvent(
          tx,
          ReviewCreatedV1,
          {
            reviewId: created.id,
            productId,
            userId: user.id,
            rating: created.rating,
            verifiedPurchase: verified,
          },
          { producer: SERVICE_NAME, aggregateId: productId },
        );
        if (created.status === 'PUBLISHED') await this.emitRating(tx, productId);
        return created;
      });
      return await this.view(row, user.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'You already reviewed this product; edit your review instead',
        );
      }
      throw error;
    }
  }

  /** Edits are moderated again; a rejected review gets a fresh chance. */
  async update(user: AuthUser, reviewId: string, input: ReviewInput): Promise<ProductReview> {
    const moderation = autoModerate(input);
    const row = await this.db.transaction(async (tx) => {
      const current = await this.lockOwn(tx, reviewId, user.id);
      const [updated] = await tx
        .update(reviews)
        .set({
          ...input,
          status: moderation.status,
          moderationNote: moderation.note,
          editedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId))
        .returning();
      if (!updated) throw notFound();
      if (current.status === 'PUBLISHED' || updated.status === 'PUBLISHED') {
        await this.emitRating(tx, updated.productId);
      }
      return updated;
    });
    return await this.view(row, user.id);
  }

  async remove(user: AuthUser, reviewId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await this.lockOwn(tx, reviewId, user.id);
      await tx.delete(reviews).where(eq(reviews.id, reviewId));
      if (current.status === 'PUBLISHED') await this.emitRating(tx, current.productId);
    });
  }

  /**
   * Helpful / not helpful. One vote per shopper (changing it moves the count);
   * `null` withdraws it. Counters change under the review's row lock.
   */
  async vote(
    userId: string,
    reviewId: string,
    vote: 'helpful' | 'not_helpful' | null,
  ): Promise<ProductReview> {
    const row = await this.db.transaction(async (tx) => {
      const review = await this.lockPublished(tx, reviewId);
      if (review.userId === userId) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'You cannot vote on your own review');
      }
      const [previous] = await tx
        .select()
        .from(reviewVotes)
        .where(and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, userId)));
      let helpful = 0;
      let notHelpful = 0;
      if (previous) {
        if (previous.helpful) helpful -= 1;
        else notHelpful -= 1;
        await tx
          .delete(reviewVotes)
          .where(and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, userId)));
      }
      if (vote) {
        await tx.insert(reviewVotes).values({ reviewId, userId, helpful: vote === 'helpful' });
        if (vote === 'helpful') helpful += 1;
        else notHelpful += 1;
      }
      const [updated] = await tx
        .update(reviews)
        .set({
          helpfulCount: sql`${reviews.helpfulCount} + ${helpful}`,
          notHelpfulCount: sql`${reviews.notHelpfulCount} + ${notHelpful}`,
        })
        .where(eq(reviews.id, reviewId))
        .returning();
      return updated ?? review;
    });
    return await this.view(row, userId);
  }

  /** Reports from enough different shoppers send a review back to moderation. */
  async report(userId: string, reviewId: string, reason: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const review = await this.lockPublished(tx, reviewId);
      if (review.userId === userId) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'You cannot report your own review');
      }
      const inserted = await tx
        .insert(reviewReports)
        .values({ reviewId, userId, reason })
        .onConflictDoNothing()
        .returning({ reviewId: reviewReports.reviewId });
      if (inserted.length === 0) return; // already reported by this shopper
      const reports = review.reportCount + 1;
      const hide = reports >= this.config.REPORTS_TO_HIDE;
      await tx
        .update(reviews)
        .set({
          reportCount: reports,
          ...(hide
            ? { status: 'PENDING' as const, moderationNote: `Reported ${String(reports)} times` }
            : {}),
        })
        .where(eq(reviews.id, reviewId));
      if (hide) await this.emitRating(tx, review.productId);
    });
  }

  // ── moderation (back office) ───────────────────────────────────────────────

  async moderationQueue(
    status: ReviewStatus,
    query: PaginationQuery,
  ): Promise<Paginated<ProductReview & { moderationNote: string | null; reportCount: number }>> {
    const { offset, limit } = toOffset(query);
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.status, status))
      .orderBy(desc(reviews.reportCount), asc(reviews.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(reviews)
      .where(eq(reviews.status, status));
    const views = await this.views(rows, null);
    return paginate(
      views.map((view, i) => ({
        ...view,
        moderationNote: rows[i]?.moderationNote ?? null,
        reportCount: rows[i]?.reportCount ?? 0,
      })),
      total,
      query,
    );
  }

  async moderate(
    reviewId: string,
    status: ReviewStatus,
    note: string | null,
  ): Promise<ProductReview> {
    const row = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .for('update');
      if (!current) throw notFound();
      const [updated] = await tx
        .update(reviews)
        .set({
          status,
          moderationNote: note,
          // Restoring a review clears the reports that hid it.
          ...(status === 'PUBLISHED' ? { reportCount: 0 } : {}),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId))
        .returning();
      if (status === 'PUBLISHED')
        await tx.delete(reviewReports).where(eq(reviewReports.reviewId, reviewId));
      if ((current.status === 'PUBLISHED') !== (status === 'PUBLISHED')) {
        await this.emitRating(tx, current.productId);
      }
      return updated ?? current;
    });
    return await this.view(row, null);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Recomputes the product's published aggregate and announces it (outbox, same transaction). */
  private async emitRating(tx: Database, productId: string): Promise<void> {
    const summary = await this.summary(productId, tx);
    await enqueueEvent(
      tx,
      ProductRatingChangedV1,
      {
        productId,
        average: summary.average,
        count: summary.count,
        distribution: summary.distribution,
      },
      { producer: SERVICE_NAME, aggregateId: productId },
    );
  }

  private async boughtIt(userId: string, productId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ orderId: purchases.orderId })
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.productId, productId),
          eq(purchases.paid, true),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /** 404 (not 403) for other people's reviews. */
  private async lockOwn(tx: Database, reviewId: string, userId: string): Promise<ReviewRow> {
    const [row] = await tx.select().from(reviews).where(eq(reviews.id, reviewId)).for('update');
    if (row?.userId !== userId) throw notFound();
    return row;
  }

  private async lockPublished(tx: Database, reviewId: string): Promise<ReviewRow> {
    const [row] = await tx.select().from(reviews).where(eq(reviews.id, reviewId)).for('update');
    if (row?.status !== 'PUBLISHED') throw notFound();
    return row;
  }

  private async view(row: ReviewRow, viewerId: string | null): Promise<ProductReview> {
    const [view] = await this.views([row], viewerId);
    if (!view) throw notFound();
    return view;
  }

  private async views(rows: ReviewRow[], viewerId: string | null): Promise<ProductReview[]> {
    const votes =
      viewerId && rows.length > 0
        ? await this.db
            .select()
            .from(reviewVotes)
            .where(
              and(
                eq(reviewVotes.userId, viewerId),
                inArray(
                  reviewVotes.reviewId,
                  rows.map((r) => r.id),
                ),
              ),
            )
        : [];
    const voteOf = new Map(
      votes.map((v) => [v.reviewId, v.helpful ? 'helpful' : 'not_helpful'] as const),
    );
    return rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      authorName: row.authorName,
      rating: row.rating,
      title: row.title,
      body: row.body,
      verifiedPurchase: row.verifiedPurchase,
      helpfulCount: row.helpfulCount,
      notHelpfulCount: row.notHelpfulCount,
      myVote: voteOf.get(row.id) ?? null,
      mine: viewerId !== null && row.userId === viewerId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
    }));
  }
}
