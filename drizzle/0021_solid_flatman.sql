ALTER TABLE "process_invoices" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "container_type" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "closed_at" date;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "customs_declaration_number" text;--> statement-breakpoint
ALTER TABLE "process_invoices" ADD CONSTRAINT "process_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;