-- ==============================================================================
-- IMPORTFLOW TMS: SCRIPT SQL PARA ENTRADA EM PRODUÇÃO
-- Zera Pedidos de Compra e Processos de Importação, PRESERVANDO o catálogo de produtos
-- ==============================================================================

BEGIN;

-- 1. Remove qualquer vínculo de chave estrangeira entre pedidos e processos
UPDATE purchase_orders SET process_id = NULL;

-- 2. Limpeza em lote de todas as tabelas operacionais e suas tabelas filhas (CASCADE)
TRUNCATE TABLE
  -- Tabelas de Pedidos de Compra
  purchase_order_documents,
  purchase_order_events,
  purchase_order_items,
  purchase_orders,

  -- Tabelas de Processos de Importação e Logística
  item_reservations,
  process_items,
  process_documents,
  process_events,
  process_payables,
  process_lpcos,
  process_invoices,
  process_freight_quote_lines,
  process_freight_quotes,
  process_supplier_quote_items,
  process_supplier_quotes,
  process_quote_events,
  processes
CASCADE;

COMMIT;

-- ------------------------------------------------------------------------------
-- TABELAS PRESERVADAS (NÃO TOCADAS):
-- - products (Catálogo de produtos)
-- - product_price_tiers (Faixas de preço MOQ)
-- - product_photos (Fotos do catálogo)
-- - product_lpcos (Licenças LPCO por filial)
-- - suppliers (Fornecedores)
-- - freight_agents (Agentes de carga)
-- - company_branches (Filiais da empresa)
-- - profiles (Usuários e perfis de acesso)
-- - locations (Portos, aeroportos, etc.)
-- - shipment_types (Tipos de embarque)
-- ------------------------------------------------------------------------------
