CREATE TYPE "public"."license_status" AS ENUM('A_REGISTRAR', 'PARA_ANALISE', 'EM_CONSULTA_PUBLICA', 'DEFERIDA', 'CANCELADA_INDEFERIDA');--> statement-breakpoint
ALTER TYPE "public"."modal" ADD VALUE 'SEA_BREAK_BULK' BEFORE 'COURIER';--> statement-breakpoint
ALTER TYPE "public"."modal" ADD VALUE 'SEA_RORO' BEFORE 'COURIER';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'PEDIDO' BEFORE 'EMBARCADO';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'PRODUCAO' BEFORE 'EMBARCADO';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'TRANSPORTE_NACIONAL' BEFORE 'ATRASADO';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'RECEBIDO' BEFORE 'ATRASADO';--> statement-breakpoint
CREATE TABLE "freight_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freight_agents_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "item_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"person_name" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"observation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "destination_code" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "destination_city" text;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "destination_state" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ncm_anterior" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "manufacturer_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "exporter_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "license_number" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "license_registered_at" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "license_status" "license_status";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "public_consultation_ref" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "license_approved_at" date;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "customs_broker_ref" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "item_reservations" ADD CONSTRAINT "item_reservations_item_id_process_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."process_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_invoices" ADD CONSTRAINT "process_invoices_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_agent_id_freight_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."freight_agents"("id") ON DELETE no action ON UPDATE no action;