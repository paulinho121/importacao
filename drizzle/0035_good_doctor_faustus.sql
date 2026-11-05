CREATE TYPE "public"."freight_quote_section" AS ENUM('FRETE', 'ORIGEM', 'DESTINO', 'OUTRAS');--> statement-breakpoint
CREATE TABLE "process_freight_quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"section" "freight_quote_section" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3),
	"unit_price" numeric(12, 4),
	"unit" text,
	"minimum" numeric(12, 2),
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "quote_date" date;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "transit_days_max" integer;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "frequency" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "cargo_description" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "gross_weight_kg" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "volumes" integer;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "volume_m3" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "dimensions" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "cargo_value" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "cargo_value_currency" "currency";--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "pickup_address" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "process_freight_quote_lines" ADD CONSTRAINT "process_freight_quote_lines_quote_id_process_freight_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."process_freight_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_freight_quote_lines_quote_idx" ON "process_freight_quote_lines" USING btree ("quote_id","position");