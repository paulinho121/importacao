ALTER TABLE "products" ADD COLUMN "ncm_divergent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ncm_official_suggested" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ncm_checked_at" date;