CREATE TABLE "inbox_events" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_events_consumer_event_id_pk" PRIMARY KEY("consumer","event_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "outbox_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"topic" text NOT NULL,
	"message_key" text NOT NULL,
	"envelope" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inbox_events_processed_idx" ON "inbox_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events" USING btree ("sequence") WHERE "outbox_events"."published_at" IS NULL;