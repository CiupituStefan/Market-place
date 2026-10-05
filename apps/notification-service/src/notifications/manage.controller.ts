import { Authenticated, ZodValidationPipe } from '@market/nest-common';
import {
  NOTIFICATION_LOG_STATUSES,
  PaginationQuerySchema,
  type NotificationLog,
} from '@market/types';
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { NotificationService } from './notification.service.js';

const LogsQuery = PaginationQuerySchema.extend({
  status: z.enum(NOTIFICATION_LOG_STATUSES).optional(),
  recipient: z.email().optional(),
});

@ApiTags('notifications (back office)')
@Controller('notifications/manage')
@Authenticated('STAFF', 'ADMIN')
export class ManageNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Delivery log, newest first' })
  logs(@Query(new ZodValidationPipe(LogsQuery)) query: z.infer<typeof LogsQuery>) {
    return this.notifications.logs(query);
  }

  @Post('logs/:id/retry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Queue a failed email again' })
  retry(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<NotificationLog> {
    return this.notifications.retry(id);
  }
}
