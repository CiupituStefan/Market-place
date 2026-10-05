import { Authenticated, CurrentUser, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import {
  DomainError,
  EmailTokenSchema,
  ErrorCode,
  UpdateNotificationPreferencesSchema,
  type AuthUser,
  type NotificationPreferences,
  type UnsubscribeResult,
  type UpdateNotificationPreferences,
} from '@market/types';
import { Body, Controller, Get, HttpCode, Inject, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { NewsletterService } from '../newsletter/newsletter.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { verifyUnsubscribeToken } from '../notifications/unsubscribe-token.js';

const UnsubscribeQuery = z.object({ token: z.string().min(16).max(1024).optional() });
/** JSON `{ token }` from the storefront, or `List-Unsubscribe=One-Click` (form) from mail clients. */
const UnsubscribeBody = EmailTokenSchema.partial().loose().optional();

@ApiTags('notifications')
@Controller('notifications')
export class PreferencesController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly db: Database,
    private readonly notifications: NotificationService,
    private readonly newsletter: NewsletterService,
  ) {}

  @Get('preferences')
  @Authenticated()
  @ApiOperation({ summary: 'Email preferences of the signed-in shopper' })
  preferences(@CurrentUser() user: AuthUser): Promise<NotificationPreferences> {
    return this.notifications.preferences(user.id, user.email);
  }

  @Put('preferences')
  @Authenticated()
  @ApiOperation({
    summary: 'Change email preferences',
    description:
      'Newsletter: a verified account email is subscribed at once; an unverified one ' +
      'receives a confirmation link first.',
  })
  @ApiBody({ schema: openApiSchema(UpdateNotificationPreferencesSchema) })
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateNotificationPreferencesSchema))
    body: UpdateNotificationPreferences,
  ): Promise<NotificationPreferences> {
    if (body.orderUpdates !== undefined) {
      await this.notifications.setOrderUpdates(this.db, user.id, body.orderUpdates);
    }
    if (body.newsletter !== undefined) {
      if (!user.email) {
        // Access tokens issued before Phase 11 carry no email: refreshing fixes it.
        throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Please sign in again');
      }
      await this.newsletter.setForAccount(
        { email: user.email, emailVerified: user.emailVerified },
        body.newsletter,
      );
    }
    return this.notifications.preferences(user.id, user.email);
  }

  /**
   * The link in an email (via the storefront page, token in the body) and RFC 8058
   * one-click unsubscribe from mail clients (token in the query string, form body).
   * No login: the signed token is the authorization, and it can only opt out.
   */
  @Post('unsubscribe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unsubscribe with a signed link token (no login)' })
  @ApiBody({ schema: openApiSchema(EmailTokenSchema) })
  async unsubscribe(
    @Query(new ZodValidationPipe(UnsubscribeQuery)) query: z.infer<typeof UnsubscribeQuery>,
    @Body(new ZodValidationPipe(UnsubscribeBody)) body: z.infer<typeof UnsubscribeBody>,
  ): Promise<UnsubscribeResult> {
    const token = body?.token ?? query.token;
    const claim = token ? verifyUnsubscribeToken(this.config.UNSUBSCRIBE_SECRET, token) : null;
    if (!claim) throw new DomainError(ErrorCode.INVALID_TOKEN, 'This link is invalid');
    if (claim.scope === 'newsletter') {
      await this.newsletter.unsubscribe(claim.email);
    } else {
      await this.notifications.setOrderUpdates(this.db, claim.userId, false);
    }
    return { scope: claim.scope };
  }
}
