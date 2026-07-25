import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const modalEnum = pgEnum("modal", [
  "AIR",
  "SEA_FCL",
  "SEA_LCL",
  "COURIER",
  "ROAD",
]);

export const processStatusEnum = pgEnum("process_status", [
  "AGUARDANDO_EMBARQUE",
  "EMBARCADO",
  "EM_TRANSITO",
  "EM_DESEMBARACO",
  "ATRASADO",
  "CONCLUIDO",
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
  invoiceNumber: text("invoice_number"),
  etd: date("etd"),
  etaEstimated: date("eta_estimated"),
  etaActual: date("eta_actual"),
  agent: text("agent"),
  destination: text("destination"),
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
  description: text("description").notNull(),
  defaultSupplierId: uuid("default_supplier_id").references(() => suppliers.id),
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
  reservedTo: text("reserved_to"),
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
