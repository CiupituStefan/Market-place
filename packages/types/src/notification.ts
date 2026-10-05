import { z } from 'zod';

export const NEWSLETTER_STATES = ['NONE', 'PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED'] as const;
export const NewsletterStateSchema = z.enum(NEWSLETTER_STATES);
export type NewsletterState = z.infer<typeof NewsletterStateSchema>;

/** What a signed-in shopper can switch off. Security and order receipts are always sent. */
export const NotificationPreferencesSchema = z.object({
  /** Shipping and delivery emails. */
  orderUpdates: z.boolean(),
  newsletter: NewsletterStateSchema,
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesSchema = z
  .object({ orderUpdates: z.boolean(), newsletter: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateNotificationPreferences = z.infer<typeof UpdateNotificationPreferencesSchema>;

export const NewsletterSubscribeSchema = z.object({
  email: z.email('Enter a valid email address.').max(254),
});

/** Single-use or signed link token from an email. */
export const EmailTokenSchema = z.object({ token: z.string().min(16).max(1024) });

export const UnsubscribeResultSchema = z.object({
  scope: z.enum(['newsletter', 'order-updates']),
});
export type UnsubscribeResult = z.infer<typeof UnsubscribeResultSchema>;

export const NOTIFICATION_LOG_STATUSES = ['QUEUED', 'SENT', 'FAILED', 'SUPPRESSED'] as const;

export const NotificationLogSchema = z.object({
  id: z.uuid(),
  template: z.string(),
  recipient: z.string(),
  userId: z.uuid().nullable(),
  status: z.enum(NOTIFICATION_LOG_STATUSES),
  subject: z.string().nullable(),
  attempts: z.int(),
  lastError: z.string().nullable(),
  suppressedReason: z.string().nullable(),
  providerMessageId: z.string().nullable(),
  /** False once the template data was erased: the email can no longer be re-sent. */
  resendable: z.boolean(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
});
export type NotificationLog = z.infer<typeof NotificationLogSchema>;
