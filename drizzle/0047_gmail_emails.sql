-- Migração 0047 (aditiva e idempotente): integração do Gmail.
-- Tabelas: conexão do Gmail por usuário, e-mails do marcador "Processos" e anexos.
-- Pode rodar mais de uma vez no SQL Editor do Supabase sem erro.

CREATE TABLE IF NOT EXISTS "gmail_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"google_email" text NOT NULL,
	"refresh_token" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "process_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gmail_message_id" text NOT NULL,
	"message_id_header" text,
	"mailbox_user_id" uuid,
	"from" text,
	"to" text,
	"subject" text,
	"sent_at" timestamp with time zone NOT NULL,
	"snippet" text,
	"body_text" text,
	"process_id" uuid,
	"status" text DEFAULT 'UNLINKED' NOT NULL,
	"linked_by" uuid,
	"linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "process_emails_gmail_message_id_unique" UNIQUE("gmail_message_id"),
	CONSTRAINT "process_emails_message_id_header_unique" UNIQUE("message_id_header")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "process_email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"storage_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "process_emails" ADD CONSTRAINT "process_emails_mailbox_user_id_profiles_id_fk" FOREIGN KEY ("mailbox_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "process_emails" ADD CONSTRAINT "process_emails_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "process_emails" ADD CONSTRAINT "process_emails_linked_by_profiles_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "process_email_attachments" ADD CONSTRAINT "process_email_attachments_email_id_process_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."process_emails"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_email_attachments_email_idx" ON "process_email_attachments" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_emails_process_idx" ON "process_emails" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_emails_sent_at_idx" ON "process_emails" USING btree ("sent_at");
--> statement-breakpoint
-- Sem políticas de acesso: o app acessa estas tabelas só pelo servidor (conexão do
-- Drizzle, dona das tabelas, que ignora RLS). Ligar RLS impede que a chave pública
-- (anon) do Supabase leia o refresh token ou o corpo dos e-mails pela API REST.
ALTER TABLE "gmail_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "process_emails" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "process_email_attachments" ENABLE ROW LEVEL SECURITY;

-- Conferência (somente leitura, depois de rodar):
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('gmail_connections','process_emails','process_email_attachments');
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('gmail_connections','process_emails','process_email_attachments');
-- SELECT count(*) FROM process_emails;
