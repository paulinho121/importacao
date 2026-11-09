ALTER TYPE "public"."freight_quote_section" ADD VALUE 'RODOVIARIO';--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "freight_quote_number" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "freight_quote_date" date;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "freight_quote_responsible" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "freight_quote_notes" text;