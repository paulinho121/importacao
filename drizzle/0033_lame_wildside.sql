CREATE TABLE "purchase_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"description" text,
	"user_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_order_events" ADD CONSTRAINT "purchase_order_events_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_order_events_po_idx" ON "purchase_order_events" USING btree ("purchase_order_id","created_at");--> statement-breakpoint
-- Histórico dos pedidos que já existiam (datas conhecidas das colunas do pedido).
INSERT INTO "purchase_order_events" ("purchase_order_id", "event_type", "description", "user_name", "created_at")
SELECT po."id", 'CRIADO', 'Pedido criado', pr."name", po."created_at"
FROM "purchase_orders" po LEFT JOIN "profiles" pr ON pr."id" = po."created_by_user_id"
WHERE NOT EXISTS (SELECT 1 FROM "purchase_order_events" e WHERE e."purchase_order_id" = po."id");
--> statement-breakpoint
INSERT INTO "purchase_order_events" ("purchase_order_id", "event_type", "description", "created_at")
SELECT po."id", 'ENVIADO', 'Pedido marcado como Enviado', po."sent_at"
FROM "purchase_orders" po
WHERE po."sent_at" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "purchase_order_events" e WHERE e."purchase_order_id" = po."id" AND e."event_type" = 'ENVIADO');
--> statement-breakpoint
INSERT INTO "purchase_order_events" ("purchase_order_id", "event_type", "description", "created_at")
SELECT po."id", 'CONFIRMADO', 'Pedido marcado como Confirmado', po."confirmed_at"
FROM "purchase_orders" po
WHERE po."confirmed_at" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "purchase_order_events" e WHERE e."purchase_order_id" = po."id" AND e."event_type" = 'CONFIRMADO');
--> statement-breakpoint
INSERT INTO "purchase_order_events" ("purchase_order_id", "event_type", "description", "created_at")
SELECT po."id", 'PROCESSO_VINCULADO', 'Pedido no processo ' || p."process_number", po."updated_at"
FROM "purchase_orders" po JOIN "processes" p ON p."id" = po."process_id"
WHERE NOT EXISTS (SELECT 1 FROM "purchase_order_events" e WHERE e."purchase_order_id" = po."id" AND e."event_type" = 'PROCESSO_VINCULADO');
