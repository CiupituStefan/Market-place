CREATE TYPE "public"."cart_item_kind" AS ENUM('variant', 'configuration');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('PERCENTAGE', 'FIXED');--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"kind" "cart_item_kind" NOT NULL,
	"variant_id" uuid,
	"configurator" text,
	"configuration_id" text,
	"selection" jsonb,
	"quantity" integer NOT NULL,
	"unit_price_snapshot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_quantity_range" CHECK ("cart_items"."quantity" BETWEEN 1 AND 10),
	CONSTRAINT "cart_items_kind_fields" CHECK (("cart_items"."kind" = 'variant' AND "cart_items"."variant_id" IS NOT NULL) OR ("cart_items"."kind" = 'configuration' AND "cart_items"."configuration_id" IS NOT NULL AND "cart_items"."selection" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_token_hash" text,
	"coupon_code" text,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carts_has_owner" CHECK ("carts"."user_id" IS NOT NULL OR "carts"."guest_token_hash" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" integer NOT NULL,
	"currency" text NOT NULL,
	"min_subtotal" integer,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"usage_limit" integer,
	"per_customer_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_value_positive" CHECK ("discount_codes"."value" > 0),
	CONSTRAINT "discount_codes_percentage_max" CHECK ("discount_codes"."type" <> 'PERCENTAGE' OR "discount_codes"."value" <= 10000),
	CONSTRAINT "discount_codes_usage_within_limit" CHECK ("discount_codes"."usage_limit" IS NULL OR "discount_codes"."used_count" <= "discount_codes"."usage_limit")
);
--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"discount_code_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"user_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_user_id_variant_id_pk" PRIMARY KEY("user_id","variant_id")
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_variant_key" ON "cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_configuration_key" ON "cart_items" USING btree ("cart_id","configuration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_user_key" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_guest_token_key" ON "carts" USING btree ("guest_token_hash");--> statement-breakpoint
CREATE INDEX "carts_updated_idx" ON "carts" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discount_redemptions_code_user_idx" ON "discount_redemptions" USING btree ("discount_code_id","user_id");