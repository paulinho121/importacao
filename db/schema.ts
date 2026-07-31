import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

// SEA_BREAK_BULK/SEA_RORO adicionados para cobrir os tipos de embarque
// marítimo vistos na planilha "FLUXOGRAMA DE IMPORTAÇÃO" (aba "Tipo de
// Embarques"). Não separamos Modalidade x Tipo de Embarque em dois campos
// (como a planilha faz) para não reescrever todos os filtros/ícones já
// construídos em cima deste enum único.
export const modalEnum = pgEnum("modal", [
  "AIR",
  "SEA_FCL",
  "SEA_LCL",
  "SEA_BREAK_BULK",
  "SEA_RORO",
  "COURIER",
  "ROAD",
]);

// PEDIDO/PRODUCAO/TRANSPORTE_NACIONAL/RECEBIDO adicionados a partir do
// pipeline de 8 estados visto na planilha (a aba TABELA AUXILIAR lista:
// Pedido, Produção, Embarque, Em Trânsito, Desembaraço, Transporte,
// Recebido, + Finalizado). Só ADICIONAMOS valores ao enum — não dá pra
// remover/renomear valor de enum Postgres com segurança tendo processos
// já gravados com os valores antigos. EMBARCADO/CONCLUIDO continuam
// existindo; o rótulo de exibição ("Embarque"/"Finalizado") é feito via
// STATUS_LABEL em lib/status.ts, sem precisar tocar no enum.
export const processStatusEnum = pgEnum("process_status", [
  "AGUARDANDO_EMBARQUE",
  "PEDIDO",
  "PRODUCAO",
  "EMBARCADO",
  "EM_TRANSITO",
  "EM_DESEMBARACO",
  "TRANSPORTE_NACIONAL",
  "RECEBIDO",
  "ATRASADO",
  "CONCLUIDO",
]);

// Status do licenciamento de importação ("Inciso V") de um produto —
// visto na aba "BD Itens Amparados Inciso V" da planilha. EM_EXIGENCIA
// adicionado depois de importar os dados reais dessa aba (404 licenças) —
// 7 delas estavam em "EM EXIGÊNCIA" (pendência documental exigida pelo
// órgão licenciador), um estado distinto de "para análise" que não
// deveria ser colapsado numa categoria genérica.
export const licenseStatusEnum = pgEnum("license_status", [
  "A_REGISTRAR",
  "PARA_ANALISE",
  "EM_CONSULTA_PUBLICA",
  "EM_EXIGENCIA",
  "DEFERIDA",
  "CANCELADA_INDEFERIDA",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "INVOICE",
  "BL",
  "PACKING_LIST",
  "OTHER",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "PENDING",
  "UPLOADED",
]);

// Moeda da operação — usada para converter os valores declarados
// (invoices, frete, seguro) em Valor Aduaneiro estimado via câmbio PTAX.
// OTHER cobre moedas fora da lista, sem busca automática de câmbio.
export const currencyEnum = pgEnum("currency", [
  "USD",
  "EUR",
  "CNY",
  "GBP",
  "JPY",
  "OTHER",
]);

// Canal de parametrização — resultado da análise de risco da declaração
// de importação (DUIMP/DI). Vermelho/Cinza exigem intervenção manual
// (verificação documental+física / suspeita de fraude ou valoração);
// preenchido manualmente por ora (sem integração com o Portal Único).
export const customsChannelEnum = pgEnum("customs_channel", [
  "VERDE",
  "AMARELO",
  "VERMELHO",
  "CINZA",
]);

// Órgãos anuentes mais comuns que exigem LPCO (Licença, Permissão,
// Certificado e Outros documentos) — nomenclatura do Portal Único que
// substituiu o antigo "LI" (Licença de Importação).
export const lpcoAgencyEnum = pgEnum("lpco_agency", [
  "ANVISA",
  "MAPA",
  "INMETRO",
  "IBAMA",
  "EXERCITO",
  "ANP",
  "DECEX",
  "OUTRO",
]);

// Fornecedores. Processos referenciam por FK, nunca por texto livre —
// resolve a duplicidade tipo "APUTURE" vs "APUTURE + DEARKOL" vista na planilha.
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  country: text("country"),
  defaultIncoterm: text("default_incoterm"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  // URL pública no bucket "supplier-logos" do Supabase Storage. Bucket
  // público (não assinado) porque o logo aparece em várias listagens ao
  // mesmo tempo — gerar signed URL por item em cada render seria caro à
  // toa para um asset que não é sensível.
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Agentes de carga (freight forwarders). Mesmo papel que suppliers: processos
// referenciam por FK em vez de texto livre — antes "agent" era texto solto
// em processes, com o mesmo risco de duplicidade/erro de digitação que
// resolvemos para fornecedor (ex: FIRST, NSL, CODELI, CRONOS, NEXT, ROCKET,
// FEDEX, confirmados na aba TABELA AUXILIAR da planilha).
export const freightAgents = pgTable("freight_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Processos de importação. status e datas são campos estruturados únicos —
// nunca texto livre misturado (ex: "Frete fechado 21/07" vira `notes`, não `etaEstimated`).
export const processes = pgTable("processes", {
  id: uuid("id").primaryKey().defaultRandom(),
  processNumber: text("process_number").notNull().unique(),
  externalReference: text("external_reference"),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  modal: modalEnum("modal"),
  etd: date("etd"),
  etaEstimated: date("eta_estimated"),
  etaActual: date("eta_actual"),
  // Substituiu o antigo campo "agent" (texto livre) — ver freightAgents.
  agentId: uuid("agent_id").references(() => freightAgents.id),
  destination: text("destination"),
  // Destino estruturado (código + cidade + UF, ex: "GRU" / "Guarulhos" /
  // "SP") — visto na planilha como "GRU - ✈️ Guarulhos (SP)". Lista de
  // opções conhecidas em lib/locations.ts. Os processos antigos mantêm só
  // `destination` (texto livre) — não tentamos parsear retroativamente.
  destinationCode: text("destination_code"),
  destinationCity: text("destination_city"),
  destinationState: text("destination_state"),
  status: processStatusEnum("status").notNull().default("AGUARDANDO_EMBARQUE"),
  currentStep: integer("current_step").notNull().default(1),
  weightKg: numeric("weight_kg", { precision: 10, scale: 2 }),
  volumeM3: numeric("volume_m3", { precision: 10, scale: 2 }),
  notes: text("notes"),
  // Rastreamento AIS (só relevante para modal marítimo). vesselImo/Mmsi são
  // identificadores digitados manualmente — a API de rastreamento não
  // descobre sozinha qual navio pertence a qual processo. Os campos
  // vessel* seguintes são um CACHE da última consulta (API paga por
  // chamada, nunca consultada automaticamente — só quando o usuário
  // clicar "Atualizar Posição").
  vesselName: text("vessel_name"),
  vesselImo: text("vessel_imo"),
  vesselMmsi: text("vessel_mmsi"),
  vesselLat: numeric("vessel_lat", { precision: 9, scale: 6 }),
  vesselLon: numeric("vessel_lon", { precision: 9, scale: 6 }),
  vesselSpeedKnots: numeric("vessel_speed_knots", { precision: 5, scale: 2 }),
  vesselHeading: integer("vessel_heading"),
  vesselDestination: text("vessel_destination"),
  vesselPositionUpdatedAt: timestamp("vessel_position_updated_at", { withTimezone: true }),
  // Dados financeiros — base para Valor Aduaneiro estimado (soma das
  // invoices + frete + seguro, convertido pelo câmbio). Tudo opcional e
  // preenchido manualmente depois da criação do processo, quando os
  // valores comerciais/frete já são conhecidos. Assume uma única moeda
  // por processo (caso comum na prática — ver lib/dashboard-metrics.ts).
  currency: currencyEnum("currency"),
  incoterm: text("incoterm"),
  internationalFreightValue: numeric("international_freight_value", { precision: 12, scale: 2 }),
  insuranceValue: numeric("insurance_value", { precision: 12, scale: 2 }),
  // Câmbio de venda PTAX (Bacen) usado para converter os valores acima
  // para BRL — ver lib/ptax.ts. exchangeRateDate é a data efetivamente
  // usada na cotação (pode diferir da data pedida em fins de semana/feriado).
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 }),
  exchangeRateDate: date("exchange_rate_date"),
  // Resultado da parametrização (Verde/Amarelo/Vermelho/Cinza) — preenchido
  // manualmente quando o resultado sai no Portal Único, sem integração
  // automática por ora.
  customsChannel: customsChannelEnum("customs_channel"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invoices de um processo — normalizado a partir do campo único que existia
// antes. A planilha tinha até 4 colunas fixas (Invoice 1-4); aqui não há
// limite, evitando reproduzir essa restrição artificial.
export const processInvoices = pgTable("process_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull(),
  // Valor FOB declarado desta invoice, na moeda de processes.currency.
  value: numeric("value", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// LPCOs (Licença, Permissão, Certificado e Outros documentos) efetivamente
// abertos/obtidos para um processo específico — um processo pode precisar
// de LPCOs de vários órgãos anuentes diferentes ao mesmo tempo. Não
// confundir com products.licenseStatus (Inciso V): aquele descreve se o
// PRODUTO exige licenciamento (fato de catálogo); esta tabela registra as
// licenças reais abertas para uma OPERAÇÃO — os dois convivem.
export const processLpcos = pgTable("process_lpcos", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  agency: lpcoAgencyEnum("agency").notNull(),
  lpcoNumber: text("lpco_number"),
  // Reaproveita licenseStatusEnum — mesmo ciclo de vida do licenciamento
  // Inciso V (a registrar/para análise/consulta pública/exigência/deferida/indeferida).
  status: licenseStatusEnum("status").notNull().default("A_REGISTRAR"),
  issuedAt: date("issued_at"),
  validUntil: date("valid_until"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Catálogo mestre de produtos. Itens de processo podem referenciar um
// produto daqui (FK opcional) em vez de digitar SKU/descrição soltos —
// garante NCM correto (obrigatório para desembaraço) e evita duplicidade.
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  manufacturerSku: text("manufacturer_sku"),
  ncm: text("ncm"),
  // Licenciamento de importação ("Inciso V") — visto na aba "BD Itens
  // Amparados Inciso V" da planilha. Todos opcionais: nem todo produto
  // exige licença de importação.
  ncmAnterior: text("ncm_anterior"),
  manufacturerName: text("manufacturer_name"),
  exporterName: text("exporter_name"),
  licenseNumber: text("license_number"),
  licenseRegisteredAt: date("license_registered_at"),
  licenseStatus: licenseStatusEnum("license_status"),
  publicConsultationRef: text("public_consultation_ref"),
  licenseApprovedAt: date("license_approved_at"),
  customsBrokerRef: text("customs_broker_ref"),
  active: boolean("active").notNull().default(true),
  description: text("description").notNull(),
  defaultSupplierId: uuid("default_supplier_id").references(() => suppliers.id),
  // Preço de compra (custo) + markup — planilhas de fornecedor trazem o
  // custo, não o preço de venda. O preço sugerido (custo × (1+markup)) é
  // calculado na UI, nunca armazenado (evita ficar desatualizado se o
  // custo ou o markup mudarem depois).
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
  costCurrency: currencyEnum("cost_currency"),
  markupPercent: numeric("markup_percent", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Itens/SKUs de cada processo. sku é sempre string — corrige a perda de
// zero à esquerda observada na planilha quando o Excel converte código em número.
// productId é opcional: item pode vir do catálogo (sku/description copiados
// no momento da inclusão, como snapshot) ou ser avulso (digitado na hora).
export const processItems = pgTable("process_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  sku: text("sku"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }),
  // reservedTo (legado, texto livre tipo "1 Joao Sousa / 1 Felipe"): mantido
  // por compatibilidade com os itens já seedados da planilha original.
  // Reservas novas usam itemReservations abaixo (permite múltiplas pessoas
  // reservando quantidades parciais do mesmo item, com disponível calculado).
  reservedTo: text("reserved_to"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Reservas de estoque por item — várias pessoas podem reservar parte da
// quantidade de um mesmo item (visto nas abas "IMP 3426"/"Modelo" da
// planilha: Qtd Pedido, Qtd Reserva, Disponível calculado). Disponível não
// é armazenado, é calculado na leitura (quantity do item − soma das reservas).
export const itemReservations = pgTable("item_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => processItems.id, { onDelete: "cascade" }),
  personName: text("person_name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  observation: text("observation"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Histórico de eventos / trilha de auditoria — a planilha não tem isso,
// ETA era sobrescrito sem deixar rastro de quando mudou.
export const processEvents = pgTable("process_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  eventType: text("event_type").notNull(),
  origin: text("origin"),
  statusAtEvent: processStatusEnum("status_at_event"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const processDocuments = pgTable("process_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  docType: documentTypeEnum("doc_type").notNull(),
  fileName: text("file_name"),
  storagePath: text("storage_path"),
  status: documentStatusEnum("status").notNull().default("PENDING"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
});
