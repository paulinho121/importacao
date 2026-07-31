CREATE TYPE "public"."customs_channel" AS ENUM('VERDE', 'AMARELO', 'VERMELHO', 'CINZA');--> statement-breakpoint
CREATE TYPE "public"."lpco_agency" AS ENUM('ANVISA', 'MAPA', 'INMETRO', 'IBAMA', 'EXERCITO', 'ANP', 'DECEX', 'OUTRO');--> statement-breakpoint
CREATE TABLE "process_lpcos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"agency" "lpco_agency" NOT NULL,
	"lpco_number" text,
	"status" "license_status" DEFAULT 'A_REGISTRAR' NOT NULL,
	"issued_at" date,
	"valid_until" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "customs_channel" "customs_channel";--> statement-breakpoint
ALTER TABLE "process_lpcos" ADD CONSTRAINT "process_lpcos_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;