CREATE TYPE "public"."external_import_item_status" AS ENUM('EM_NEGOCIACAO', 'AGUARDANDO_EMBARQUE', 'EM_DESEMBARACO', 'CONCLUIDO', 'CONSOLIDADO_EM_OUTRO_PROCESSO', 'CANCELADO');--> statement-breakpoint
CREATE TABLE "external_import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text,
	"description" text NOT NULL,
	"quantity" numeric(10, 2),
	"supplier_name" text,
	"process_number" text,
	"status" "external_import_item_status",
	"modal" text,
	"invoice" text,
	"etd" date,
	"eta" date,
	"agent" text,
	"destination" text,
	"reservation" text,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
