CREATE TABLE "product_lpcos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"status" text DEFAULT 'NAO_SOLICITADO' NOT NULL,
	"requested_at" date,
	"approved_at" date,
	"lpco_number" text,
	"technical_sheet" boolean,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "public_consultation_date" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "has_public_consultation" boolean;--> statement-breakpoint
ALTER TABLE "product_lpcos" ADD CONSTRAINT "product_lpcos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;