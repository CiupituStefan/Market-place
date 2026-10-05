import { z } from 'zod';
import { defineEvent } from '../define.js';
import { Topics } from '../topics.js';

export const NOTIFICATION_TEMPLATES = [
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
  'ORDER_CONFIRMATION',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'PAYMENT_FAILED',
  'REFUND_ISSUED',
  'NEWSLETTER_WELCOME',
] as const;

export const NotificationRequestedV1 = defineEvent({
  type: 'NotificationRequested',
  version: 1,
  topic: Topics.NOTIFICATION,
  payload: z.object({
    /** Deduplication key: the same key is delivered at most once. */
    notificationKey: z.string().min(1),
    channel: z.enum(['EMAIL']),
    template: z.enum(NOTIFICATION_TEMPLATES),
    recipient: z.object({ userId: z.uuid().nullable(), email: z.email() }),
    /** Template variables. Must never contain secrets other than single-use links. */
    data: z.record(z.string(), z.unknown()),
  }),
});
