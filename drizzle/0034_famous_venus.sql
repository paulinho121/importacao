CREATE TABLE "process_freight_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"agent_id" uuid,
	"proposal" text,
	"modal" "modal",
	"incoterm" text,
	"carrier" text,
	"origin" text,
	"destination" text,
	"transit_days" integer,
	"valid_until" date,
	"freight_value" numeric(12, 2),
	"freight_currency" "currency" DEFAULT 'USD' NOT NULL,
	"origin_fees_value" numeric(12, 2),
	"origin_fees_currency" "currency" DEFAULT 'USD' NOT NULL,
	"destination_fees_value" numeric(12, 2),
	"destination_fees_currency" "currency" DEFAULT 'BRL' NOT NULL,
	"other_fees_label" text,
	"other_fees_value" numeric(12, 2),
	"other_fees_currency" "currency" DEFAULT 'BRL' NOT NULL,
	"notes" text,
	"is_selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD CONSTRAINT "process_freight_quotes_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_freight_quotes" ADD CONSTRAINT "process_freight_quotes_agent_id_freight_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."freight_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_freight_quotes_process_idx" ON "process_freight_quotes" USING btree ("process_id");