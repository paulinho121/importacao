CREATE TABLE "process_quote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"quote_type" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"description" text NOT NULL,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_supplier_quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"sku" text,
	"description" text NOT NULL,
	"quantity" numeric(12, 3),
	"unit_price" numeric(14, 4),
	"total" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_supplier_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"supplier_id" uuid,
	"proposal" text,
	"quote_date" date,
	"valid_until" date,
	"status" text DEFAULT 'SOLICITADA' NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"total_value" numeric(14, 2),
	"incoterm" text,
	"commercial_terms" text,
	"payment_terms" text,
	"production_days" integer,
	"drive_url" text,
	"file_name" text,
	"storage_path" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "etd_estimated" date;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "eta_estimated" date;--> statement-breakpoint
ALTER TABLE "process_quote_events" ADD CONSTRAINT "process_quote_events_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_supplier_quote_items" ADD CONSTRAINT "process_supplier_quote_items_quote_id_process_supplier_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."process_supplier_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_supplier_quotes" ADD CONSTRAINT "process_supplier_quotes_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_supplier_quotes" ADD CONSTRAINT "process_supplier_quotes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_quote_events_quote_idx" ON "process_quote_events" USING btree ("quote_type","quote_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "process_quote_events_process_idx" ON "process_quote_events" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_supplier_quote_items_quote_idx" ON "process_supplier_quote_items" USING btree ("quote_id","position");--> statement-breakpoint
CREATE INDEX "process_supplier_quotes_process_idx" ON "process_supplier_quotes" USING btree ("process_id");