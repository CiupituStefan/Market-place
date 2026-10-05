CREATE TYPE "public"."availability" AS ENUM('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PREORDER');--> statement-breakpoint
CREATE TYPE "public"."configurator_group" AS ENUM('layout', 'case', 'switch', 'plate', 'keycaps', 'connection');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('keyboard', 'switch', 'keycaps', 'stabilizer', 'cable', 'deskmat', 'wristrest');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_id" uuid,
	"preview" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configurator_incompatibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configurator_id" uuid NOT NULL,
	"group_a" "configurator_group" NOT NULL,
	"value_a" text NOT NULL,
	"group_b" "configurator_group" NOT NULL,
	"value_b" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configurator_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configurator_id" uuid NOT NULL,
	"group" "configurator_group" NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"price_delta_amount" integer DEFAULT 0 NOT NULL,
	"sku_code" text NOT NULL,
	"swatch" text,
	"preview" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "configurator_options_delta_non_negative" CHECK ("configurator_options"."price_delta_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "configurators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sku_prefix" text NOT NULL,
	"base_price_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"base_preview" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "product_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"options" jsonb NOT NULL,
	"price_amount" integer NOT NULL,
	"compare_at_amount" integer,
	"currency" text NOT NULL,
	"availability" "availability" DEFAULT 'IN_STOCK' NOT NULL,
	"preview" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_price_positive" CHECK ("product_variants"."price_amount" >= 0),
	CONSTRAINT "product_variants_compare_at_above_price" CHECK ("product_variants"."compare_at_amount" IS NULL OR "product_variants"."compare_at_amount" > "product_variants"."price_amount")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"category_id" uuid NOT NULL,
	"kind" "product_kind" NOT NULL,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"highlights" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"included" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"compatibility" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"badges" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"featured_rank" integer,
	"min_price_amount" integer,
	"min_price_compare_at_amount" integer,
	"currency" text NOT NULL,
	"availability" "availability" DEFAULT 'OUT_OF_STOCK' NOT NULL,
	"rating_average" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"search_document" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "products"."search_document")) STORED,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_rating_range" CHECK ("products"."rating_average" BETWEEN 0 AND 5)
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configurator_incompatibilities" ADD CONSTRAINT "configurator_incompatibilities_configurator_id_configurators_id_fk" FOREIGN KEY ("configurator_id") REFERENCES "public"."configurators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configurator_options" ADD CONSTRAINT "configurator_options_configurator_id_configurators_id_fk" FOREIGN KEY ("configurator_id") REFERENCES "public"."configurators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "configurator_incompatibilities_idx" ON "configurator_incompatibilities" USING btree ("configurator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "configurator_options_unique" ON "configurator_options" USING btree ("configurator_id","group","value");--> statement-breakpoint
CREATE UNIQUE INDEX "configurators_slug_key" ON "configurators" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events" USING btree ("created_at") WHERE "outbox_events"."published_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_attributes_unique" ON "product_attributes" USING btree ("product_id","key","value");--> statement-breakpoint
CREATE INDEX "product_attributes_key_value_idx" ON "product_attributes" USING btree ("key","value");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_search_vector_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "products_search_trgm_idx" ON "products" USING gin ("search_document" gin_trgm_ops);