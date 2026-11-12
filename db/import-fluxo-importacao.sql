-- Importação da planilha "FLUXOGRAMA DE IMPORTAÇÃO - Fluxo de Importação" (24 processos).
-- Gerado a partir do CSV; rode UMA vez no SQL Editor do Supabase.
--
-- Seguro para rodar de novo: fornecedores/agentes usam ON CONFLICT DO NOTHING e os
-- processos só são criados se o número ainda não existir (invoices e andamentos
-- são gravados apenas para os processos criados nesta execução).
--
-- Decisões assumidas (ver comentários por processo):
--  * Números normalizados: "IMP 32 / 26" -> "IMP 32/26"; "MCI.FIRST23 - 26" -> "MCI.FIRST23-26".
--  * Status: Finalizado=CONCLUIDO, Pedido=PEDIDO, Produção=PRODUCAO, Em Trânsito=EM_TRANSITO,
--    Desembaraço=EM_DESEMBARACO, Recebido em Estoque=RECEBIDO, Cancelado=ABANDONADO.
--  * "Cotação" na coluna Agente = frete em cotação (agente fica vazio, vai para as observações).
--  * Coluna IMO: 7 dígitos -> vessel_imo; qualquer outro valor (AWB, courier, HAWB) -> tracking_number.
--  * FECHAMENTO -> closed_at. Nº DUIMP é extraído do follow-up (primeiro "26BR...").
--  * Follow-up: 1 andamento por data encontrada; texto sem data (rótulo) vai junto da data seguinte.
--    Origem "Manual · Importação da planilha" => pode ser removido na tela do processo.
--  * created_at do processo = ETD (quando existe) para o Dashboard ficar em ordem cronológica.
--  * Os links dos botões "TRACKING" não vêm no CSV: tracking_url fica vazio.

-- 1) Fornecedores e agentes que ainda não existem
INSERT INTO suppliers (name) VALUES
  ('DEARKOL'),
  ('ARTSON'),
  ('MILIBOO'),
  ('CREAMSOURCE')
ON CONFLICT (name) DO NOTHING;

INSERT INTO freight_agents (name) VALUES
  ('CTA'),
  ('DHL')
ON CONFLICT (name) DO NOTHING;

-- 2) Processos + invoices + andamentos (um único comando, atômico)
WITH p (process_number, external_reference, supplier_name, modal, etd, eta, agent_name, destination, destination_code, destination_city, destination_state, status, current_step, container_type, tracking_number, closed_at, customs_declaration_number, vessel_imo, notes) AS (VALUES
  ('IMP 28/26', NULL, 'ASTERA', 'AIR', '2026-07-01', '2026-07-12', 'NSL', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Air Cargo', NULL, '2026-07-24', NULL, NULL, NULL),
  ('IMP 34/26', NULL, 'APUTURE', 'AIR', '2026-07-01', '2026-07-12', 'NSL', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Air Cargo', NULL, '2026-07-14', NULL, NULL, NULL),
  ('IMP 32/26', 'NSLIM2238/26', 'SWIT', 'SEA_LCL', '2026-08-04', '2026-09-03', 'NSL', 'BRITJ - Itajaí (SC)', 'BRITJ', 'Itajaí', 'SC', 'CONCLUIDO', 8, 'LCL', NULL, NULL, '26BR00018533753', '9717216', NULL),
  ('MCI.FIRST05-26', 'IM2968-26', 'SECCED', 'SEA_LCL', '2026-08-05', '2026-09-30', 'ROCKET', 'BRNVT - Navegantes (Portonave) (SC)', 'BRNVT', 'Navegantes (Portonave)', 'SC', 'CONCLUIDO', 8, 'LCL', NULL, NULL, NULL, '9996757', NULL),
  ('MCI.FIRST04-26', 'NSLIA0773/26 03/31037', 'SWIT', 'AIR', '2026-08-27', '2026-09-15', 'NSL', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Air Cargo', 'WA26080240A', NULL, '26BR0001759081', NULL, NULL),
  ('MCI.FIRST17-26', 'IA0752-26', 'APUTURE', 'AIR', '2026-09-10', '2026-09-17', 'ROCKET', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Air Cargo', '112-90723150', NULL, NULL, NULL, NULL),
  ('MCI.FIRST13-26', '013153/26-01', 'ASTERA', 'AIR', '2026-09-03', '2026-09-13', 'NSL', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Air Cargo', NULL, '2026-09-14', NULL, NULL, NULL),
  ('MCI.FIRST11-26', 'IA0673-26', 'SECCED', 'AIR', NULL, NULL, 'FEDEX', 'VCP - Viracopos - Campinas (SP)', 'VCP', 'Viracopos - Campinas', 'SP', 'CONCLUIDO', 8, 'Air Cargo', '874073361926', NULL, NULL, NULL, NULL),
  ('MCI.FIRST19-26', 'RKT-012374-26-0 IA0778-26', 'APUTURE', 'AIR', '2026-09-25', '2026-09-28', 'ROCKET', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Consolidated', '176-65270752', NULL, '26BR0001894665-9', NULL, NULL),
  ('MCI.FIRST18-26', NULL, 'DZOFILM', 'AIR', NULL, NULL, 'CTA', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Air Cargo', NULL, NULL, NULL, NULL, NULL),
  ('MCI.FIRST16-26', 'NSLIM3534/26', 'DEARKOL', 'SEA_LCL', '2026-09-06', '2026-10-19', 'NSL', 'BRNVT - Navegantes (Portonave) (SC)', 'BRNVT', 'Navegantes (Portonave)', 'SC', 'EM_DESEMBARACO', 6, 'LCL', NULL, NULL, '26BR0002128419-0', '9976599', NULL),
  ('MCI.FIRST15-26', 'IM3376-26', 'SWIT', 'SEA_FCL', '2026-09-15', '2026-11-29', 'ROCKET', 'BRNVT - Navegantes (Portonave) (SC)', 'BRNVT', 'Navegantes (Portonave)', 'SC', 'EM_TRANSITO', 5, 'FCL 40'' HC', NULL, NULL, NULL, '9637155', NULL),
  ('MCI.FIRST14-26', NULL, 'ARTSON', 'AIR', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'PEDIDO', 2, 'Air Cargo', NULL, NULL, NULL, NULL, 'Frete em cotação (coluna Agente da planilha: ''Cotação'').'),
  ('MCI.FIRST06-26', NULL, 'APUTURE', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ABANDONADO', 1, NULL, NULL, NULL, NULL, NULL, 'Fornecedor não informado na planilha; assumido APUTURE (itens deste processo no registro externo são Aputure + Dearkol) — conferir. Agente não informado na planilha.'),
  ('MCI.FIRST23-26', 'IM4348-26', 'APUTURE', 'SEA_FCL', '2026-11-02', '2026-12-10', 'ROCKET', 'BRITJ - Itajaí (SC)', 'BRITJ', 'Itajaí', 'SC', 'PRODUCAO', 3, 'FCL 40'' NOR', NULL, NULL, NULL, NULL, NULL),
  ('MCI.FIRST20-26', '7816408633', 'SECCED', 'COURIER', '2026-09-30', '2026-10-08', 'DHL', 'MCI Filial SP', 'FIL-SP', 'MCI Filial SP', 'SP', 'CONCLUIDO', 8, 'Courier', '7816408633', NULL, NULL, NULL, NULL),
  ('MCI.FIRST21-26', 'RKT-013343-26-01 IA0809-26', 'APUTURE', 'AIR', '2026-10-06', NULL, 'ROCKET', 'GRU - Guarulhos (SP)', 'GRU', 'Guarulhos', 'SP', 'CONCLUIDO', 8, 'Air Cargo', '074-47994995', NULL, '26BR00019881070', NULL, NULL),
  ('MCI.FIRST22-26', NULL, 'MILIBOO', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'PEDIDO', 2, NULL, NULL, NULL, NULL, NULL, 'Frete em cotação (coluna Agente da planilha: ''Cotação''). Modal marítimo; tipo (FCL/LCL) não informado na planilha.'),
  ('MCI.FIRST24-26', NULL, 'CREAMSOURCE', 'AIR', NULL, NULL, NULL, 'MCI Filial SC', 'FIL-SC', 'MCI Filial SC', 'SC', 'PEDIDO', 2, 'Air Cargo', NULL, NULL, NULL, NULL, 'Frete em cotação (coluna Agente da planilha: ''Cotação'').'),
  ('MCI.FIRST25-26', 'RKT-014949-26 IA0869-26', 'ASTERA', 'AIR', NULL, NULL, 'ROCKET', 'MCI Filial SP', 'FIL-SP', 'MCI Filial SP', 'SP', 'PEDIDO', 2, 'Air Cargo', NULL, NULL, NULL, NULL, NULL),
  ('MCI.FIRST26-26', NULL, 'DZOFILM', 'AIR', NULL, NULL, NULL, 'MCI Filial SP', 'FIL-SP', 'MCI Filial SP', 'SP', 'EM_DESEMBARACO', 6, 'Air Cargo', '176-64974755', NULL, NULL, NULL, 'Agente não informado na planilha.'),
  ('MCI.FIRST27-26', NULL, 'DZOFILM', 'AIR', NULL, NULL, NULL, 'MCI Filial SP', 'FIL-SP', 'MCI Filial SP', 'SP', 'RECEBIDO', 8, 'Air Cargo', '176-67746792', NULL, NULL, NULL, 'Agente não informado na planilha.'),
  ('MCI.FIRST28-26', 'KT-014722-26 IA0868-26', 'APUTURE', 'AIR', NULL, NULL, 'ROCKET', 'MCI Filial SP', 'FIL-SP', 'MCI Filial SP', 'SP', 'PEDIDO', 2, 'Air Cargo', NULL, NULL, NULL, NULL, NULL),
  ('MCI.FIRST29-26', NULL, 'APUTURE', 'SEA_FCL', '2026-11-29', NULL, NULL, 'BRITJ - Itajaí (SC)', 'BRITJ', 'Itajaí', 'SC', 'AGUARDANDO_EMBARQUE', 1, 'FCL 40'' NOR', NULL, NULL, NULL, NULL, 'Sem status na planilha (agente ''Cotação''): tratado como etapa de cotação. Frete em cotação (coluna Agente da planilha: ''Cotação'').')
),
ins AS (
  INSERT INTO processes (process_number, external_reference, supplier_id, modal, etd, eta_estimated, agent_id,
    destination, destination_code, destination_city, destination_state, status, current_step, container_type,
    tracking_number, closed_at, customs_declaration_number, vessel_imo, notes, created_at, updated_at)
  SELECT p.process_number, p.external_reference, s.id, p.modal::modal, p.etd::date, p.eta::date, a.id,
    p.destination, p.destination_code, p.destination_city, p.destination_state,
    p.status::process_status, p.current_step::int, p.container_type, p.tracking_number, p.closed_at::date,
    p.customs_declaration_number, p.vessel_imo, p.notes,
    COALESCE(p.etd::timestamptz, now()), now()
  FROM p
  JOIN suppliers s ON upper(s.name) = p.supplier_name
  LEFT JOIN freight_agents a ON upper(a.name) = p.agent_name
  ON CONFLICT (process_number) DO NOTHING
  RETURNING id, process_number
),
inv (process_number, invoice_number, supplier_name) AS (VALUES
  ('IMP 28/26', 'DII8945', NULL),
  ('IMP 34/26', 'SOHK276369', NULL),
  ('IMP 32/26', '26SWIT306', NULL),
  ('MCI.FIRST05-26', 'SC260615-1B', NULL),
  ('MCI.FIRST04-26', '26SWIT376', NULL),
  ('MCI.FIRST17-26', 'SOHK295271', NULL),
  ('MCI.FIRST13-26', 'DISO7809', NULL),
  ('MCI.FIRST11-26', 'SE260611-1B', NULL),
  ('MCI.FIRST19-26', 'DISO7891', 'ASTERA'),
  ('MCI.FIRST19-26', 'SOHK278372', NULL),
  ('MCI.FIRST18-26', 'DZA6XY26090203', NULL),
  ('MCI.FIRST16-26', 'MK2026716', NULL),
  ('MCI.FIRST15-26', '26SWIT461', NULL),
  ('MCI.FIRST15-26', 'SOHK264032 II', 'APUTURE'),
  ('MCI.FIRST15-26', 'SOHK284300', 'APUTURE'),
  ('MCI.FIRST23-26', 'SOHK301229', NULL),
  ('MCI.FIRST20-26', 'SE260915-1B', NULL),
  ('MCI.FIRST21-26', 'PI SOHK303074', NULL),
  ('MCI.FIRST24-26', 'SO-107735 - PO CSMCI261002', NULL),
  ('MCI.FIRST25-26', 'DISO7988', NULL),
  ('MCI.FIRST26-26', 'DZA6XY26100901', NULL),
  ('MCI.FIRST27-26', 'DZA6XY26080701', NULL),
  ('MCI.FIRST28-26', 'PI SOHK310029 - ATUALIZADA', NULL)
),
ins_inv AS (
  INSERT INTO process_invoices (process_id, invoice_number, supplier_id)
  SELECT ins.id, inv.invoice_number, s.id
  FROM inv
  JOIN ins ON ins.process_number = inv.process_number
  LEFT JOIN suppliers s ON upper(s.name) = inv.supplier_name
  RETURNING 1
),
ev (process_number, event_date, event_type) AS (VALUES
  ('IMP 32/26', '2026-09-03', 'Data registrada na planilha (sem descrição)'),
  ('IMP 32/26', '2026-09-08', 'Data registrada na planilha (sem descrição)'),
  ('IMP 32/26', '2026-09-09', 'Data registrada na planilha (sem descrição)'),
  ('IMP 32/26', '2026-09-11', 'Data registrada na planilha (sem descrição)'),
  ('IMP 32/26', '2026-09-11', 'Data registrada na planilha (sem descrição)'),
  ('IMP 32/26', '2026-09-11', '11/09/2026 !!!!'),
  ('IMP 32/26', '2026-09-14', 'Data registrada na planilha (sem descrição)'),
  ('IMP 32/26', '2026-09-22', 'Previsão de carregamento DTA — 22/09/2026'),
  ('IMP 32/26', '2026-09-23', 'Data registrada na planilha (sem descrição)'),
  ('IMP 32/26', '2026-09-24', '24/09/2026 — numerário — DUIMP-26BR00018533753'),
  ('MCI.FIRST05-26', '2026-07-15', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-07-17', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-07-20', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-08-24', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-09-08', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-09-15', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-09-21', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-09-23', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-09-23', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-07-28', 'Previsão de atracação — 28/07/2026'),
  ('MCI.FIRST05-26', '2026-10-01', 'Presença de caraga — 01/10'),
  ('MCI.FIRST05-26', '2026-10-05', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST05-26', '2026-10-06', 'carga desovada 06/10/2026'),
  ('MCI.FIRST05-26', '2026-10-08', 'Chega no Estoque Sanco Amanha 08/10/2026'),
  ('MCI.FIRST04-26', '2026-08-30', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST04-26', '2026-09-01', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST04-26', '2026-09-03', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST04-26', '2026-09-04', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST04-26', '2026-09-11', 'Deadline — 11/09/2026'),
  ('MCI.FIRST04-26', '2026-09-14', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST04-26', '2026-09-15', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST04-26', '2026-09-16', 'DESEMBARQUE 16/09/2026 — 26BR0001759081'),
  ('MCI.FIRST17-26', '2026-08-27', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-08-31', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-09-01', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-09-04', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-09-05', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-09-08', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-09-10', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-09-11', 'Embarque - 11/09'),
  ('MCI.FIRST17-26', '2026-09-15', 'CHEGADA 15/09/2026'),
  ('MCI.FIRST17-26', '2026-09-17', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST17-26', '2026-09-17', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST13-26', '2026-09-08', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST13-26', '2026-09-08', 'CONTATO DHL — Desembarque — 08/09/2026'),
  ('MCI.FIRST13-26', '2026-09-09', 'faltou um volume — 09/09/2026 — recebimento 2º carga'),
  ('MCI.FIRST11-26', '2026-07-20', 'tracking: 874073361926 — 20/07/2026'),
  ('MCI.FIRST11-26', '2026-07-21', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST11-26', '2026-07-22', '22/07/2026 — A caminho'),
  ('MCI.FIRST19-26', '2026-09-18', 'MAI8853 — 18/09/2026'),
  ('MCI.FIRST19-26', '2026-09-23', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST19-26', '2026-09-28', 'chegada antecipada, 28/09/2026'),
  ('MCI.FIRST19-26', '2026-09-28', 'CHEGADA CONFIRMADA 28/09 — DUIMP: 26BR0001894665-9'),
  ('MCI.FIRST16-26', '2026-08-17', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-08-19', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-08-24', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-08-27', 'Booking — 27/08/2026'),
  ('MCI.FIRST16-26', '2026-09-01', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-09-02', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-09-08', 'HBL final aprovado — 08/09/2026'),
  ('MCI.FIRST16-26', '2026-09-14', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-09-24', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-10-01', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-10-08', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-10-15', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-10-19', '19/10/2026 - ETA'),
  ('MCI.FIRST16-26', '2026-10-23', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-10-23', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST16-26', '2026-10-26', '26/10/2026 - REGISTRADA — 26BR0002128419-0'),
  ('MCI.FIRST15-26', '2026-08-21', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST15-26', '2026-09-14', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST15-26', '2026-09-15', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST15-26', '2026-09-29', 'HBL FINAL — 29/09/2026'),
  ('MCI.FIRST15-26', '2026-10-06', '06/10/2026 Atualizaçao de chegada'),
  ('MCI.FIRST15-26', '2026-10-06', '06/10/2026 🔥'),
  ('MCI.FIRST15-26', '2026-10-19', '19/10/2026 🔥'),
  ('MCI.FIRST15-26', '2026-10-22', '22/10/2026 - INFORMAÇÃO DO NOVO ETA'),
  ('MCI.FIRST15-26', '2026-10-29', '29/10/2026 - Retorno a Durban'),
  ('MCI.FIRST23-26', '2026-10-08', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST23-26', '2026-10-09', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST23-26', '2026-10-15', '15/10/2026 - Informações do booking disponibilizadas.'),
  ('MCI.FIRST23-26', '2026-10-19', '19/10/2026 A coleta da mercadoria foi programada para o dia 23/10/2026.'),
  ('MCI.FIRST23-26', '2026-10-24', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST23-26', '2026-10-29', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST20-26', '2026-09-30', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST20-26', '2026-10-06', 'recebido no dia 06/10/2026'),
  ('MCI.FIRST21-26', '2026-09-23', 'Data registrada na planilha (sem descrição)'),
  ('MCI.FIRST21-26', '2026-10-06', 'DRAFT — embarque confirmado dia06/10'),
  ('MCI.FIRST21-26', '2026-10-06', 'previsão de booking 06/10/2026'),
  ('MCI.FIRST21-26', '2026-10-08', 'CONFIRMAÇÃO DE CHEGADA - IMPORTAÇÃO AÉREA - 08/10/2026'),
  ('MCI.FIRST21-26', '2026-10-14', 'Número da declaração: 26BR00019881070 Chave de acesso: 26Tgb017317482 — 14/10/2026 Coletado'),
  ('MCI.FIRST25-26', '2026-10-28', '28/10/2026 21:59 data do fechamento'),
  ('MCI.FIRST26-26', '2026-10-27', 'COLETADO PARA FILIAL 27/10/2026'),
  ('MCI.FIRST27-26', '2026-10-27', 'COLETADO PARA FILIAL 27/10/2026'),
  ('MCI.FIRST28-26', '2026-10-28', '28/10/2026 21:52 data de fechamento'),
  ('MCI.FIRST28-26', '2026-10-29', '29/10/2026 Carga prevista prar ficar pronta dia 02/11')
),
ins_ev AS (
  INSERT INTO process_events (process_id, event_date, event_type, origin)
  SELECT ins.id, (ev.event_date::date)::timestamp + interval '12 hours', ev.event_type, 'Manual · Importação da planilha'
  FROM ev
  JOIN ins ON ins.process_number = ev.process_number
  WHERE ev.event_date IS NOT NULL
  RETURNING 1
),
ins_marker AS (
  INSERT INTO process_events (process_id, event_date, event_type, origin)
  SELECT ins.id, now(), 'Processo importado da planilha "Fluxo de Importação"', 'Importação da planilha'
  FROM ins
  RETURNING 1
)
SELECT
  (SELECT count(*) FROM ins)        AS processos_criados,
  (SELECT count(*) FROM ins_inv)    AS invoices_criadas,
  (SELECT count(*) FROM ins_ev)     AS andamentos_criados;
