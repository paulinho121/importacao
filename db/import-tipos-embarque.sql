-- Tabelas de referência da planilha "FLUXOGRAMA DE IMPORTAÇÃO - Tipo de Embarques".
-- Rode UMA vez no SQL Editor do Supabase (seguro rodar de novo: cria só se não existir
-- e os dados usam ON CONFLICT DO NOTHING).
--
--  * shipment_types: modalidade + tipo de embarque + descrição (16 tipos). modal_code
--    liga ao enum `modal` usado nos processos (FCL 20'/40'/HC/NOR -> SEA_FCL etc.);
--    o nome do tipo é o mesmo texto de processes.container_type.
--  * locations: portos (7), aeroportos (8), filiais MCI (3) e terminais terrestres (10).
--    O mesmo código existe em tipos diferentes (NVT = aeroporto e terminal), então a
--    unicidade é (code, kind). As filiais usam FIL-SP / FIL-SC / FIL-CE (padrão já
--    usado no app); FIL-CE (MCI Filial CE) é nova.

CREATE TABLE IF NOT EXISTS "shipment_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "modality" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "modal_code" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "shipment_types_modality_name_unique" UNIQUE("modality","name")
);

CREATE TABLE IF NOT EXISTS "locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "city" text,
  "state" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "locations_code_kind_unique" UNIQUE("code","kind")
);

INSERT INTO shipment_types (modality, name, description, modal_code, sort_order) VALUES
  ('MARITIMO', 'FCL', 'FCL (Full Container Load) – Contêiner cheio exclusivo para um importador.', 'SEA_FCL', 1),
  ('MARITIMO', 'LCL', 'LCL (Less than Container Load) – Carga consolidada (compartilha contêiner com outros).', 'SEA_LCL', 2),
  ('MARITIMO', 'Break Bulk', 'Break Bulk – Carga solta (sem contêiner, peças grandes).', 'SEA_BREAK_BULK', 3),
  ('MARITIMO', 'RORO', 'RORO (Roll-on/Roll-off) – Veículos que entram rodando no navio.', 'SEA_RORO', 4),
  ('MARITIMO', 'FCL 20''', 'FCL 20'' – Contêiner padrão de 20 pés, exclusivo para um importador.', 'SEA_FCL', 5),
  ('MARITIMO', 'FCL 20'' HC', 'FCL 20'' HC (High Cube) – Contêiner de 20 pés com altura elevada, exclusivo para um importador.', 'SEA_FCL', 6),
  ('MARITIMO', 'FCL 40''', 'FCL 40'' – Contêiner padrão de 40 pés, exclusivo para um importador.', 'SEA_FCL', 7),
  ('MARITIMO', 'FCL 40'' HC', 'FCL 40'' HC (High Cube) – Contêiner de 40 pés com altura elevada, exclusivo para um importador.', 'SEA_FCL', 8),
  ('MARITIMO', 'FCL 20'' NOR', 'FCL 20'' NOR (Non-Operating Reefer) – Contêiner refrigerado utilizado sem refrigeração para transporte de carga seca.', 'SEA_FCL', 9),
  ('MARITIMO', 'FCL 40'' NOR', 'FCL 40'' NOR (Non-Operating Reefer) – Contêiner refrigerado utilizado sem refrigeração para transporte de carga seca.', 'SEA_FCL', 10),
  ('AEREO', 'Air Cargo', 'Air Cargo (Carga Aérea Convencional) – Envio em aeronaves cargueiras.', 'AIR', 11),
  ('AEREO', 'Courier', 'Express Courier – DHL, FedEx, UPS (pequenas encomendas urgentes).', 'COURIER', 12),
  ('AEREO', 'Consolidated', 'Consolidated Air Cargo – cargas agrupadas em um único embarque.', 'AIR', 13),
  ('TERRESTRE', 'FTL', 'FTL (Full Truck Load) – Caminhão fechado completo.', 'ROAD', 14),
  ('TERRESTRE', 'LTL', 'LTL (Less than Truck Load) – Carga fracionada.', 'ROAD', 15),
  ('TERRESTRE', 'Cross-border trucking', 'Cross-border trucking – transporte internacional rodoviário.', 'ROAD', 16)
ON CONFLICT (modality, name) DO NOTHING;

INSERT INTO locations (code, kind, name, city, state, sort_order) VALUES
  ('BRITJ', 'PORTO', 'Itajaí', 'Itajaí', 'SC', 1),
  ('BRNVT', 'PORTO', 'Portonave - Navegantes', 'Navegantes', 'SC', 2),
  ('BRIOA', 'PORTO', 'Itapoá', 'Itapoá', 'SC', 3),
  ('BRSFS', 'PORTO', 'São Francisco do Sul', 'São Francisco do Sul', 'SC', 4),
  ('BRSSZ', 'PORTO', 'Santos', 'Santos', 'SP', 5),
  ('BRPEC', 'PORTO', 'Pecém', 'Pecém', 'CE', 6),
  ('BRFOR', 'PORTO', 'Fortaleza - Mucuripe', 'Fortaleza', 'CE', 7),
  ('GRU', 'AEROPORTO', 'Guarulhos', 'Guarulhos', 'SP', 8),
  ('VCP', 'AEROPORTO', 'Viracopos - Campinas', 'Campinas', 'SP', 9),
  ('CGH', 'AEROPORTO', 'Congonhas', 'São Paulo', 'SP', 10),
  ('FLN', 'AEROPORTO', 'Florianópolis', 'Florianópolis', 'SC', 11),
  ('NVT', 'AEROPORTO', 'Navegantes', 'Navegantes', 'SC', 12),
  ('JOI', 'AEROPORTO', 'Joinville', 'Joinville', 'SC', 13),
  ('FOR', 'AEROPORTO', 'Fortaleza', 'Fortaleza', 'CE', 14),
  ('JDO', 'AEROPORTO', 'Juazeiro do Norte', 'Juazeiro do Norte', 'CE', 15),
  ('FIL-SP', 'FILIAL', 'MCI Filial SP', 'São Paulo', 'SP', 16),
  ('FIL-SC', 'FILIAL', 'MCI Filial SC', 'Santa Catarina', 'SC', 17),
  ('FIL-CE', 'FILIAL', 'MCI Filial CE', 'Ceará', 'CE', 18),
  ('ITJ', 'TERMINAL', 'Itajaí', 'Itajaí', 'SC', 19),
  ('NVT', 'TERMINAL', 'Navegantes', 'Navegantes', 'SC', 20),
  ('IOA', 'TERMINAL', 'Itapoá', 'Itapoá', 'SC', 21),
  ('SFS', 'TERMINAL', 'São Francisco do Sul', 'São Francisco do Sul', 'SC', 22),
  ('SSZ', 'TERMINAL', 'Santos', 'Santos', 'SP', 23),
  ('VCP', 'TERMINAL', 'Campinas', 'Campinas', 'SP', 24),
  ('GRU', 'TERMINAL', 'Guarulhos', 'Guarulhos', 'SP', 25),
  ('SAO', 'TERMINAL', 'São Paulo', 'São Paulo', 'SP', 26),
  ('FOR', 'TERMINAL', 'Fortaleza', 'Fortaleza', 'CE', 27),
  ('PEC', 'TERMINAL', 'Pecém', 'Pecém', 'CE', 28)
ON CONFLICT (code, kind) DO NOTHING;

-- Conferência: deve listar 16 tipos e 28 locais (7 portos, 8 aeroportos, 3 filiais, 10 terminais).
SELECT 'shipment_types' AS tabela, count(*) FROM shipment_types
UNION ALL SELECT 'locations', count(*) FROM locations;
