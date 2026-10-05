import { openApiSchema, ZodValidationPipe } from '@market/nest-common';
import { EmailTokenSchema, NewsletterSubscribeSchema } from '@market/types';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { NewsletterService } from './newsletter.service.js';

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscriptions')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Start double opt-in',
    description:
      'Always 202: the response never reveals whether the address is already subscribed. ' +
      'A confirmation email is sent at most once per 10 minutes per address.',
  })
  @ApiBody({ schema: openApiSchema(NewsletterSubscribeSchema) })
  async subscribe(
    @Body(new ZodValidationPipe(NewsletterSubscribeSchema))
    body: z.infer<typeof NewsletterSubscribeSchema>,
  ): Promise<{ status: 'pending_confirmation' }> {
    await this.newsletter.subscribe(body.email, 'storefront');
    return { status: 'pending_confirmation' };
  }

  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a subscription with the emailed token' })
  @ApiBody({ schema: openApiSchema(EmailTokenSchema) })
  async confirm(
    @Body(new ZodValidationPipe(EmailTokenSchema)) body: z.infer<typeof EmailTokenSchema>,
  ): Promise<{ status: 'subscribed' }> {
    await this.newsletter.confirm(body.token);
    return { status: 'subscribed' };
  }
}
