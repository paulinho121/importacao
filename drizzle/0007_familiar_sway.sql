CREATE TYPE "public"."currency" AS ENUM('USD', 'EUR', 'CNY', 'GBP', 'JPY', 'OTHER');--> statement-breakpoint
ALTER TABLE "process_invoices" ADD COLUMN "value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "currency" "currency";--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "incoterm" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "international_freight_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "insurance_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "exchange_rate" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "exchange_rate_date" date;