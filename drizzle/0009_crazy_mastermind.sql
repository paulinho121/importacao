ALTER TABLE "products" ADD COLUMN "cost_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_currency" "currency";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "markup_percent" numeric(6, 2);