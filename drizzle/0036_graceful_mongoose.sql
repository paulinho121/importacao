ALTER TABLE "process_freight_quotes" ADD COLUMN "modalidade" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "container_type" text;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD COLUMN "status" text DEFAULT 'ATUALIZADO' NOT NULL;