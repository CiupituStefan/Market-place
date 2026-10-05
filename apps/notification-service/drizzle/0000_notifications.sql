CREATE TYPE "public"."newsletter_status" AS ENUM('PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('QUEUED', 'SENT', 'FAILED', 'SUPPRESSED');--> statement-breakpoint
CREATE TABLE "inbox_events" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_events_consumer_event_id_pk" PRIMARY KEY("consumer","event_id")
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"email" text PRIMARY KEY NOT NULL,
	"status" "newsletter_status" NOT NULL,
	"confirm_token_hash" text,
	"confirm_expires_at" timestamp with time zone,
	"confirm_sent_at" timestamp with time zone,
	"source" text NOT NULL,
	"subscribed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_email_lower" CHECK ("newsletter_subscribers"."email" = lower("newsletter_subscribers"."email"))
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_key" text NOT NULL,
	"channel" text DEFAULT 'EMAIL' NOT NULL,
	"template" text NOT NULL,
	"user_id" uuid,
	"recipient" text NOT NULL,
	"data" jsonb,
	"status" "notification_status" DEFAULT 'QUEUED' NOT NULL,
	"subject" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"provider_message_id" text,
	"suppressed_reason" text,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"order_updates" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_contacts" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inbox_events_processed_idx" ON "inbox_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_confirm_token_key" ON "newsletter_subscribers" USING btree ("confirm_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_logs_key" ON "notification_logs" USING btree ("notification_key");--> statement-breakpoint
CREATE INDEX "notification_logs_due_idx" ON "notification_logs" USING btree ("next_attempt_at") WHERE "notification_logs"."status" = 'QUEUED';--> statement-breakpoint
CREATE INDEX "notification_logs_recipient_idx" ON "notification_logs" USING btree ("recipient","created_at");--> statement-breakpoint
CREATE INDEX "notification_logs_status_created_idx" ON "notification_logs" USING btree ("status","created_at");