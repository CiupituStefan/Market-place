import { Authenticated, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import { PaginationQuerySchema, ReviewStatusSchema, type ProductReview } from '@market/types';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ReviewService } from './review.service.js';

const QueueQuery = PaginationQuerySchema.extend({ status: ReviewStatusSchema.default('PENDING') });
const ModerateSchema = z
  .object({ status: ReviewStatusSchema, note: z.string().trim().max(300).nullable().default(null) })
  .strict();

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('reviews (back office)')
@Controller('reviews/manage')
@Authenticated('STAFF', 'ADMIN')
export class ManageReviewsController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  @ApiOperation({ summary: 'Moderation queue (most reported first, then oldest)' })
  queue(@Query(new ZodValidationPipe(QueueQuery)) query: z.infer<typeof QueueQuery>) {
    return this.reviews.moderationQueue(query.status, query);
  }

  @Post(':id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish, hold or reject a review' })
  @ApiBody({ schema: openApiSchema(ModerateSchema) })
  moderate(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ModerateSchema)) body: z.infer<typeof ModerateSchema>,
  ): Promise<ProductReview> {
    return this.reviews.moderate(id, body.status, body.note);
  }
}
