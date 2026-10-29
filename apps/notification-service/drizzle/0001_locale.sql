ALTER TABLE "newsletter_subscribers" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_contacts" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;