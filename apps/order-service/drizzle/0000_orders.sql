CREATE TYPE "public"."order_item_kind" AS ENUM('variant', 'configuration');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 100001 CACHE 1;--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "order_item_kind" NOT NULL,
	"variant_id" uuid,
	"configurator" text,
	"configuration_id" text,
	"selection" jsonb,
	"product_slug" text,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"options_label" text NOT NULL,
	"preview" jsonb NOT NULL,
	"image_url" text,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"line_total" integer NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_line_total" CHECK ("order_items"."line_total" = "order_items"."unit_price" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_status_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"note" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" text DEFAULT 'CSE-' || nextval('order_number_seq') NOT NULL,
	"status" "order_status" NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"access_token_hash" text,
	"guest_cart_hash" text,
	"cart_id" uuid,
	"currency" text NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer NOT NULL,
	"shipping" integer NOT NULL,
	"tax" integer NOT NULL,
	"vat_rate_bps" integer NOT NULL,
	"total" integer NOT NULL,
	"coupon_code" text,
	"shipping_address" jsonb NOT NULL,
	"billing_address" jsonb NOT NULL,
	"notes" text,
	"reservation_id" uuid,
	"payment_id" uuid,
	"payment_due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"refund_required" boolean DEFAULT false NOT NULL,
	"failure_reason" text,
	"carrier" text,
	"tracking_number" text,
	"tracking_url" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_amounts_valid" CHECK ("orders"."subtotal" >= 0 AND "orders"."discount" >= 0 AND "orders"."shipping" >= 0 AND "orders"."tax" >= 0 AND "orders"."total" = "orders"."subtotal" - "orders"."discount" + "orders"."shipping"),
	CONSTRAINT "orders_has_owner" CHECK ("orders"."user_id" IS NOT NULL OR "orders"."access_token_hash" IS NOT NULL)
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
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id","position");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_key" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_due_idx" ON "orders" USING btree ("status","payment_due_at");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events" USING btree ("created_at") WHERE "outbox_events"."published_at" IS NULL;