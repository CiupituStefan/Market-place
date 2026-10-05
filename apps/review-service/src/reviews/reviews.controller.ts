import {
  Authenticated,
  CurrentUser,
  MaybeUser,
  OptionallyAuthenticated,
  openApiSchema,
  ZodValidationPipe,
} from '@market/nest-common';
import {
  CreateReviewSchema,
  PaginationQuerySchema,
  ReviewInputSchema,
  ReviewSortSchema,
  type AuthUser,
  type CreateReview,
  type ProductReview,
  type ReviewInput,
  type ReviewPage,
} from '@market/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ReviewService } from './review.service.js';

const ListQuery = PaginationQuerySchema.extend({
  productId: z.uuid(),
  sort: ReviewSortSchema.default('helpful'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verified: z
    .enum(['1', 'true'])
    .optional()
    .transform((v) => v !== undefined),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
const MineQuery = z.object({ productId: z.uuid() });
const VoteSchema = z.object({ vote: z.enum(['helpful', 'not_helpful']).nullable() }).strict();
const ReportSchema = z
  .object({ reason: z.enum(['spam', 'offensive', 'off_topic', 'not_genuine', 'other']) })
  .strict();

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  @OptionallyAuthenticated()
  @ApiOperation({ summary: 'Published reviews of a product, with its rating summary' })
  list(
    @Query(new ZodValidationPipe(ListQuery)) query: z.infer<typeof ListQuery>,
    @MaybeUser() user?: AuthUser,
  ): Promise<ReviewPage> {
    return this.reviews.list(
      query.productId,
      {
        sort: query.sort,
        rating: query.rating,
        verifiedOnly: query.verified,
        page: query.page,
        pageSize: query.pageSize,
      },
      user?.id ?? null,
    );
  }

  @Get('mine')
  @Authenticated()
  @ApiOperation({ summary: 'My review of a product (any status), or null' })
  async mine(
    @Query(new ZodValidationPipe(MineQuery)) query: z.infer<typeof MineQuery>,
    @CurrentUser() user: AuthUser,
  ): Promise<{ review: ProductReview | null }> {
    return { review: await this.reviews.mine(query.productId, user.id) };
  }

  @Post()
  @Authenticated()
  @ApiOperation({ summary: 'Write a review (one per product; verified email required)' })
  @ApiBody({ schema: openApiSchema(CreateReviewSchema) })
  create(
    @Body(new ZodValidationPipe(CreateReviewSchema)) body: CreateReview,
    @CurrentUser() user: AuthUser,
  ): Promise<ProductReview> {
    const { productId, ...input } = body;
    return this.reviews.create(user, productId, input);
  }

  @Patch(':id')
  @Authenticated()
  @ApiBody({ schema: openApiSchema(ReviewInputSchema) })
  update(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ReviewInputSchema)) body: ReviewInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ProductReview> {
    return this.reviews.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Authenticated()
  async remove(@Param('id', uuid) id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.reviews.remove(user, id);
  }

  @Put(':id/vote')
  @Authenticated()
  @ApiOperation({ summary: 'Helpful / not helpful (null withdraws the vote)' })
  @ApiBody({ schema: openApiSchema(VoteSchema) })
  vote(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(VoteSchema)) body: z.infer<typeof VoteSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<ProductReview> {
    return this.reviews.vote(user.id, id, body.vote);
  }

  @Post(':id/report')
  @HttpCode(204)
  @Authenticated()
  @ApiBody({ schema: openApiSchema(ReportSchema) })
  async report(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ReportSchema)) body: z.infer<typeof ReportSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.reviews.report(user.id, id, body.reason);
  }
}
