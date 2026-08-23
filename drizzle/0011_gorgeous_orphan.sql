CREATE TYPE "public"."payable_category" AS ENUM('FORNECEDOR', 'FRETE', 'SEGURO', 'DESEMBARACO', 'ARMAZENAGEM', 'IMPOSTO', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('ADMIN', 'OPERADOR');--> statement-breakpoint
CREATE TABLE "process_payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"category" "payable_category" NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"due_date" date,
	"paid_at" date,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "profile_role" DEFAULT 'OPERADOR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "process_items" ADD COLUMN "unit_value_override" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate_ii" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate_ipi" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate_pis" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate_cofins" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate_icms" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "process_payables" ADD CONSTRAINT "process_payables_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;