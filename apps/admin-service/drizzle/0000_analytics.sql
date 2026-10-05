CREATE TYPE "public"."sales_status" AS ENUM('PENDING_PAYMENT', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "inbox_events" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_events_consumer_event_id_pk" PRIMARY KEY("consumer","event_id")
);
--> statement-breakpoint
CREATE TABLE "sales_lines" (
	"order_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"kind" text NOT NULL,
	"variant_id" uuid,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	CONSTRAINT "sales_lines_order_id_line_no_pk" PRIMARY KEY("order_id","line_no"),
	CONSTRAINT "sales_lines_quantity_positive" CHECK ("sales_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"currency" text NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer NOT NULL,
	"shipping" integer NOT NULL,
	"tax" integer NOT NULL,
	"total" integer NOT NULL,
	"coupon_code" text,
	"shipping_country" text NOT NULL,
	"status" "sales_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"was_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text
);
--> statement-breakpoint
CREATE TABLE "sales_refunds" (
	"refund_id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"refunded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_lines" ADD CONSTRAINT "sales_lines_order_id_sales_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("order_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_events_processed_idx" ON "inbox_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "sales_lines_sku_idx" ON "sales_lines" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "sales_orders_paid_at_idx" ON "sales_orders" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "sales_orders_created_at_idx" ON "sales_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sales_orders_user_idx" ON "sales_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sales_refunds_refunded_at_idx" ON "sales_refunds" USING btree ("refunded_at");