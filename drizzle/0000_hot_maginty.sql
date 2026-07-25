CREATE TYPE "public"."document_status" AS ENUM('PENDING', 'UPLOADED');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('INVOICE', 'BL', 'PACKING_LIST', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."modal" AS ENUM('AIR', 'SEA_FCL', 'SEA_LCL', 'COURIER', 'ROAD');--> statement-breakpoint
CREATE TYPE "public"."process_status" AS ENUM('AGUARDANDO_EMBARQUE', 'EMBARCADO', 'EM_TRANSITO', 'EM_DESEMBARACO', 'ATRASADO', 'CONCLUIDO');--> statement-breakpoint
CREATE TABLE "process_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"doc_type" "document_type" NOT NULL,
	"file_name" text,
	"status" "document_status" DEFAULT 'PENDING' NOT NULL,
	"uploaded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "process_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"event_type" text NOT NULL,
	"origin" text,
	"status_at_event" "process_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"sku" text,
	"description" text NOT NULL,
	"quantity" numeric(10, 2),
	"reserved_to" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_number" text NOT NULL,
	"external_reference" text,
	"supplier_id" uuid NOT NULL,
	"modal" "modal",
	"invoice_number" text,
	"etd" date,
	"eta_estimated" date,
	"eta_actual" date,
	"agent" text,
	"destination" text,
	"status" "process_status" DEFAULT 'AGUARDANDO_EMBARQUE' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"weight_kg" numeric(10, 2),
	"volume_m3" numeric(10, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processes_process_number_unique" UNIQUE("process_number")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"default_incoterm" text,
	"contact_name" text,
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "process_documents" ADD CONSTRAINT "process_documents_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_events" ADD CONSTRAINT "process_events_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_items" ADD CONSTRAINT "process_items_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;