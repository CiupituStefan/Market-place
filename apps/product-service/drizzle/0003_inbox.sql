CREATE TABLE "inbox_events" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_events_consumer_event_id_pk" PRIMARY KEY("consumer","event_id")
);
--> statement-breakpoint
CREATE INDEX "inbox_events_processed_idx" ON "inbox_events" USING btree ("processed_at");