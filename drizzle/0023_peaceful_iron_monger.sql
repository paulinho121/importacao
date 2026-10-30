ALTER TABLE "process_items" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "process_items" ADD COLUMN "exchange_coverage" boolean;--> statement-breakpoint
ALTER TABLE "process_items" ADD COLUMN "lpco_public_consultation" boolean;--> statement-breakpoint
ALTER TABLE "process_items" ADD COLUMN "lpco_number" text;--> statement-breakpoint
ALTER TABLE "process_items" ADD CONSTRAINT "process_items_invoice_id_process_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."process_invoices"("id") ON DELETE set null ON UPDATE no action;