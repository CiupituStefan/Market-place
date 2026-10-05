CREATE TYPE "public"."stock_movement_type" AS ENUM('RECEIVED', 'ADJUSTMENT', 'RESERVED', 'RELEASED', 'EXPIRED', 'SOLD');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "inventory" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_on_hand_non_negative" CHECK ("inventory"."on_hand" >= 0),
	CONSTRAINT "inventory_reserved_non_negative" CHECK ("inventory"."reserved" >= 0),
	CONSTRAINT "inventory_reserved_within_on_hand" CHECK ("inventory"."reserved" <= "inventory"."on_hand"),
	CONSTRAINT "inventory_threshold_non_negative" CHECK ("inventory"."low_stock_threshold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "reservation_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"release_reason" text
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"message_key" text NOT NULL,
	"envelope" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_reservation_items" (
	"reservation_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "inventory_reservation_items_reservation_id_variant_id_pk" PRIMARY KEY("reservation_id","variant_id"),
	CONSTRAINT "inventory_reservation_items_quantity_positive" CHECK ("inventory_reservation_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"on_hand_delta" integer NOT NULL,
	"reserved_delta" integer NOT NULL,
	"on_hand_after" integer NOT NULL,
	"reserved_after" integer NOT NULL,
	"reservation_id" uuid,
	"order_id" uuid,
	"reason" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_reservation_items" ADD CONSTRAINT "inventory_reservation_items_reservation_id_inventory_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."inventory_reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation_items" ADD CONSTRAINT "inventory_reservation_items_variant_id_inventory_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."inventory"("variant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_inventory_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."inventory"("variant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_sku_key" ON "inventory" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservations_order_key" ON "inventory_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_active_expiry_idx" ON "inventory_reservations" USING btree ("expires_at") WHERE "inventory_reservations"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events" USING btree ("created_at") WHERE "outbox_events"."published_at" IS NULL;--> statement-breakpoint
CREATE INDEX "stock_movements_variant_idx" ON "stock_movements" USING btree ("variant_id","created_at");