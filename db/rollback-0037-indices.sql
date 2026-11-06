-- Reversão da migração 0037 (índices de desempenho). Execute no SQL Editor do Supabase.
-- É segura: só remove índices; nenhum dado é alterado.
DROP INDEX IF EXISTS "item_reservations_item_idx";
DROP INDEX IF EXISTS "process_documents_process_idx";
DROP INDEX IF EXISTS "process_events_process_date_idx";
DROP INDEX IF EXISTS "process_invoices_process_idx";
DROP INDEX IF EXISTS "process_items_process_idx";
DROP INDEX IF EXISTS "process_items_purchase_order_idx";
DROP INDEX IF EXISTS "process_lpcos_process_idx";
DROP INDEX IF EXISTS "process_payables_process_idx";
DROP INDEX IF EXISTS "product_lpcos_product_idx";
DROP INDEX IF EXISTS "product_price_tiers_product_idx";
DROP INDEX IF EXISTS "products_default_supplier_idx";
DROP INDEX IF EXISTS "purchase_order_documents_po_idx";
DROP INDEX IF EXISTS "purchase_order_items_po_idx";
DROP INDEX IF EXISTS "purchase_orders_process_idx";
