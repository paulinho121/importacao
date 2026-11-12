ALTER TYPE "public"."process_status" ADD VALUE 'AGUARDANDO_APROVACAO';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'PEDIDO_CONFIRMADO';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'AGUARDANDO_PRODUCAO';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'PRODUCAO_CONCLUIDA';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'AGUARDANDO_COLETA_ORIGEM';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'EM_ANALISE_ADUANEIRA';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'EM_EXIGENCIA';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'AGUARDANDO_LIBERACAO_TERMINAL';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'AGUARDANDO_RETIRADA';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'EM_CONFERENCIA';--> statement-breakpoint
ALTER TYPE "public"."process_status" ADD VALUE 'EM_ESTOQUE';