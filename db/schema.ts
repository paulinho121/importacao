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
  unique,
  index,
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
  // Encerramento manual e imediato (ver abandonProcess em
  // app/processos/actions.ts) — processo que não vai seguir adiante
  // (pedido cancelado pelo fornecedor, desistência, etc.), fora da
  // progressão normal do workflow, igual ATRASADO/CONCLUIDO.
  "ABANDONADO",
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
  // Adicionado pra contas a pagar (process_payables) — desembaraço e
  // armazenagem normalmente já são cobrados em reais por prestadores
  // nacionais, diferente de invoice/frete/seguro (sempre moeda
  // estrangeira). Nenhum valor existente usa BRL ainda.
  "BRL",
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

// Papel do usuário no sistema — Admin vê/edita tudo (inclusive
// Financeiro/Configurações); Operador vê/edita a operação, sem acesso a
// essas duas telas. Modelo simples de propósito — sem matriz de
// permissão por tela.
export const profileRoleEnum = pgEnum("profile_role", ["ADMIN", "OPERADOR"]);

// Categoria de uma conta a pagar — define de onde veio o custo dentro do
// processo (fornecedor, frete internacional, seguro, desembaraço
// aduaneiro, armazenagem, imposto apurado, ou outro).
export const payableCategoryEnum = pgEnum("payable_category", [
  "FORNECEDOR",
  "FRETE",
  "SEGURO",
  "DESEMBARACO",
  "ARMAZENAGEM",
  "IMPOSTO",
  "OUTRO",
]);

// Ciclo de vida do Pedido de Compra — nasce Rascunho (edita itens
// livremente), vira Enviado quando o documento já foi mandado pro
// fornecedor (itens travados a partir daí — o documento passa a
// representar o que foi de fato enviado), e Confirmado quando o
// fornecedor aceita (só a partir daí pode virar Processo de Importação).
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "RASCUNHO",
  "ENVIADO",
  "CONFIRMADO",
  "CANCELADO",
]);

// Perfil de cada usuário autenticado. `id` é o mesmo valor de
// `auth.users.id` do Supabase Auth (schema `auth`, gerenciado pelo
// Supabase) — sem FK cruzando schema porque o Drizzle não tem acesso
// direto a esse schema; a integridade é garantida na aplicação (só é
// criado junto com o usuário no Supabase Auth, ver db/seed-admin.ts).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: profileRoleEnum("role").notNull().default("OPERADOR"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Filiais/matriz da própria empresa (compradora) — mesmo CNPJ raiz, sedes
// diferentes (ex: Multicomercial e Importadora LTDA tem endereço em Itajaí,
// São Paulo e Fortaleza, cada uma com sufixo de CNPJ próprio). Selecionada
// ao criar um pedido de compra pra aparecer no documento impresso como
// "Comprador" — sem isso o PDF só mostrava o fornecedor.
export const companyBranches = pgTable("company_branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  address: text("address").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  fax: text("fax"),
  notes: text("notes"),
  // Endereço de fábrica do fabricante — visto em invoice real como
  // "Manufacturer Add:", pode divergir do endereço do exportador
  // (comum vender via trading intermediária, ex: Aputure fabrica na
  // China mas fatura via Hong Kong).
  manufacturerAddress: text("manufacturer_address"),
  // Exportador/faturador de fato, quando é uma empresa diferente do
  // fabricante (ex: "AMGREAT HONG KONG LIMITED" fatura pela Aputure).
  // Deixa em branco quando fabricante e exportador são a mesma empresa.
  exporterName: text("exporter_name"),
  exporterAddress: text("exporter_address"),
  // Dados bancários pra remessa internacional — aparecem no documento
  // impresso do pedido de compra ("USD pay to:" na invoice de
  // referência), pra não precisar digitar de novo em cada pedido.
  bankBeneficiary: text("bank_beneficiary"),
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  bankAddress: text("bank_address"),
  swiftCode: text("swift_code"),
  // Texto livre tipo "Your Attention please:" — instruções de pagamento
  // que o fornecedor sempre repete (ex: não descontar taxa bancária do
  // total, como confirmar o pagamento etc.).
  paymentInstructions: text("payment_instructions"),
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
  // Filial MCI que recebe a carga no fim ("SP" | "SC", ver BRANCHES em
  // lib/locations.ts). `destination*` acima passou a ser o local de
  // desembarque (porto/aeroporto).
  destinationBranch: text("destination_branch"),
  status: processStatusEnum("status").notNull().default("AGUARDANDO_EMBARQUE"),
  currentStep: integer("current_step").notNull().default(1),
  weightKg: numeric("weight_kg", { precision: 10, scale: 2 }),
  volumeM3: numeric("volume_m3", { precision: 10, scale: 2 }),
  // Dados de embarque vistos na planilha "Fluxo de Importação" do time —
  // todos opcionais, preenchidos conforme o processo avança.
  // containerType: "Tipo de Embarque" (ex: FCL 40' HC, 40' NOR, Consolidated,
  // Courier) — texto livre porque a planilha mistura tipo de container com
  // tipo de carga aérea; `modal` continua sendo a classificação estruturada.
  containerType: text("container_type"),
  // Nº de rastreio: B/L ou AWB (a coluna "IMO" da planilha misturava isso
  // com IMO de navio; o IMO continua em vesselImo) ou código courier.
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  // Data de fechamento do processo (coluna "FECHAMENTO" da planilha).
  closedAt: date("closed_at"),
  // Nº da DUIMP/DI registrada.
  customsDeclarationNumber: text("customs_declaration_number"),
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
  // Cabeçalho da planilha de cotações de frete (vale para o processo todo)
  freightQuoteNumber: text("freight_quote_number"),
  freightQuoteDate: date("freight_quote_date"),
  freightQuoteResponsible: text("freight_quote_responsible"),
  freightQuoteNotes: text("freight_quote_notes"),
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
  // Embarque consolidado (ex: Swit + Aputure no mesmo processo) tem uma
  // invoice por fornecedor — processes.supplierId continua sendo o
  // fornecedor principal; aqui fica o dono real de cada invoice. Opcional:
  // vazio = fornecedor do processo.
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  // Valor FOB declarado desta invoice, na moeda de processes.currency.
  value: numeric("value", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("process_invoices_process_idx").on(t.processId),
]);

// Contas a pagar ligadas a um processo — fornecedor, frete, seguro,
// desembaraço, armazenagem, imposto apurado etc. Só controle/trilha (data
// de vencimento, se já foi pago e quando); não executa pagamento nenhum.
// "Vencida" é calculado na leitura via diasRestantes(dueDate) (mesmo
// helper já usado pra ETA/LPCO em lib/status.ts), não um status
// armazenado — evita ficar desatualizado.
export const processPayables = pgTable("process_payables", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id")
    .notNull()
    .references(() => processes.id, { onDelete: "cascade" }),
  category: payableCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull(),
  dueDate: date("due_date"),
  paidAt: date("paid_at"),
  notes: text("notes"),
  // Sem FK cruzando pro schema auth do Supabase — mesmo raciocínio de
  // profiles.id (ver comentário lá).
  createdByUserId: uuid("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("process_payables_process_idx").on(t.processId),
]);

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
}, (t) => [
  index("process_lpcos_process_idx").on(t.processId),
]);

// Catálogo mestre de produtos. Itens de processo podem referenciar um
// produto daqui (FK opcional) em vez de digitar SKU/descrição soltos —
// garante NCM correto (obrigatório para desembaraço) e evita duplicidade.
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  manufacturerSku: text("manufacturer_sku"),
  // `description` é o NOME do produto (usado em listas, buscas e itens);
  // longDescription é a descrição detalhada, texto livre opcional.
  longDescription: text("long_description"),
  // Consulta Pública (CP): data, e se o produto já possui licença aprovada
  // identificada na consulta (null = não informado). A identificação da CP
  // fica em publicConsultationRef. As solicitações de LPCO (por filial, com
  // histórico) ficam em productLpcos.
  publicConsultationDate: date("public_consultation_date"),
  // Foto do produto: link externo ou arquivo enviado (png/jpeg/webp) — ver
  // app/produtos/actions.ts.
  photoUrl: text("photo_url"),
  // Etapa "Consulta Pública" do fluxo do produto (lib/product-flow.ts):
  // NAO_VERIFICADO | POSSUI | NAO_POSSUI | SOLICITADA (em acompanhamento).
  // Substitui o antigo hasPublicConsultation (boolean), que não expressa
  // "solicitada"; o boolean continua na tabela mas deixou de ser usado.
  cpStatus: text("cp_status"),
  cpRequestedAt: date("cp_requested_at"),
  hasPublicConsultation: boolean("has_public_consultation"),
  // Resultado da última varredura contra a lista pública do governo
  // ("Relação dos resultados das apurações de produção nacional", enviada
  // manualmente em .ods): FOUND (consta = deferido), FOUND_NATIONAL (consta,
  // mas com fabricante nacional informado) ou NOT_FOUND (não consta ainda).
  cpListResult: text("cp_list_result"),
  cpListRef: text("cp_list_ref"), // CP(s) em que o item aparece na lista (ex: "35/26")
  cpListNcm: text("cp_list_ncm"), // NCM informada na lista
  cpListCheckedAt: timestamp("cp_list_checked_at", { withTimezone: true }),
  cpListSource: text("cp_list_source"), // nome do arquivo conferido
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
  // Sinaliza quando o NCM cadastrado diverge do que a lista oficial mais
  // recente do Decex mostra ("Relação dos resultados das apurações de
  // produção nacional", art. 42 da Portaria Secex 249/2023 — cruzamento
  // manual, sem integração automática por ora). ncmOfficialSuggested
  // guarda o valor da fonte oficial pra comparação lado a lado;
  // ncmCheckedAt registra quando foi conferido.
  ncmDivergent: boolean("ncm_divergent").notNull().default(false),
  ncmOfficialSuggested: text("ncm_official_suggested"),
  ncmCheckedAt: date("ncm_checked_at"),
  // Alíquotas de importação do NCM deste produto — cadastradas
  // manualmente (sem integração com a tabela TEC). Usadas em
  // lib/import-tax.ts pra calcular II/IPI/PIS/COFINS/ICMS na fórmula em
  // cascata padrão. Percentuais (ex: 12.5 = 12,5%), todas opcionais.
  taxRateII: numeric("tax_rate_ii", { precision: 6, scale: 3 }),
  taxRateIPI: numeric("tax_rate_ipi", { precision: 6, scale: 3 }),
  taxRatePIS: numeric("tax_rate_pis", { precision: 6, scale: 3 }),
  taxRateCOFINS: numeric("tax_rate_cofins", { precision: 6, scale: 3 }),
  taxRateICMS: numeric("tax_rate_icms", { precision: 6, scale: 3 }),
  // Especificações de carton (caixa de embarque) — vistas na "Carton
  // Specs" da price list do fornecedor (Pieces per Carton / Length /
  // Height / Width / Weight). Base pra estimar cubagem (m³) e quantos
  // containers um pedido vai precisar — ver lib/container-estimate.ts.
  // Cubagem em si não é armazenada (calculada a partir das 3 dimensões,
  // mesmo princípio do preço sugerido: nunca fica desatualizada).
  // numeric (não integer) por consistência com o resto do form de produto
  // (quantidade/preço sempre chegam como string do FormData — ver
  // readProductForm em app/produtos/actions.ts).
  cartonPiecesPerCarton: numeric("carton_pieces_per_carton", { precision: 6, scale: 0 }),
  cartonLengthCm: numeric("carton_length_cm", { precision: 8, scale: 2 }),
  cartonWidthCm: numeric("carton_width_cm", { precision: 8, scale: 2 }),
  cartonHeightCm: numeric("carton_height_cm", { precision: 8, scale: 2 }),
  cartonWeightKg: numeric("carton_weight_kg", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("products_default_supplier_idx").on(t.defaultSupplierId),
]);

// Preço por faixa de quantidade (MOQ) — ex: Aputure vende "amaran Halo
// 100x" a US$92 na unidade, mas US$85 a partir de 100 unidades. price
// vale a partir de minQuantity (inclusive), na mesma moeda de
// products.costCurrency. Aplicado automaticamente ao escolher item de
// pedido de compra: a maior faixa cuja minQuantity <= quantidade digitada
// vence (ver lib/price-tiers.ts).
export const productPriceTiers = pgTable("product_price_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  minQuantity: numeric("min_quantity", { precision: 10, scale: 2 }).notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("product_price_tiers_product_idx").on(t.productId),
]);

// Registro externo de itens que já estão em importação (controle
// paralelo que o usuário mantinha numa planilha própria, fora do
// sistema — cada linha vem de um processo/embarque que não
// necessariamente foi criado aqui dentro). Serve só de referência:
// ao montar um pedido de compra, o item escolhido é comparado contra
// esta tabela (por SKU ou descrição) pra avisar "isso já está vindo".
// Sem FK pro catálogo (products) de propósito — nem todo item aqui tem
// correspondente exato cadastrado, e o objetivo é so alertar, não
// reconciliar automaticamente.
export const externalImportItemStatusEnum = pgEnum("external_import_item_status", [
  "EM_NEGOCIACAO",
  "AGUARDANDO_EMBARQUE",
  "EM_DESEMBARACO",
  "CONCLUIDO",
  "CONSOLIDADO_EM_OUTRO_PROCESSO",
  "CANCELADO",
]);

export const externalImportItems = pgTable("external_import_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }),
  supplierName: text("supplier_name"),
  processNumber: text("process_number"),
  status: externalImportItemStatusEnum("status"),
  modal: text("modal"),
  invoice: text("invoice"),
  etd: date("etd"),
  eta: date("eta"),
  agent: text("agent"),
  destination: text("destination"),
  reservation: text("reservation"),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Pedido de Compra — etapa formal ANTES do processo de importação
// existir. Nasce Rascunho, vira Enviado quando o documento (ver
// /pedidos-compra/[id]/imprimir) é gerado pra mandar ao fornecedor, e só
// depois de Confirmado é que pode virar um processo de verdade (ver
// convertToProcess em app/pedidos-compra/actions.ts) — processId fica
// nulo até essa conversão acontecer.
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  // Qual filial da própria empresa está comprando — aparece no documento
  // impresso como "Comprador". Opcional pra não quebrar pedidos criados
  // antes desse campo existir.
  branchId: uuid("branch_id").references(() => companyBranches.id),
  status: purchaseOrderStatusEnum("status").notNull().default("RASCUNHO"),
  currency: currencyEnum("currency"),
  incoterm: text("incoterm"),
  // Ex: "Net 120 Days", "50% deposit / 50% before shipment" — texto livre,
  // aparece no documento impresso em inglês (mesmo padrão de layout visto
  // em invoices reais de fornecedor, ex: AMGREAT/Aputure).
  paymentTerms: text("payment_terms"),
  expectedDeliveryDate: date("expected_delivery_date"),
  notes: text("notes"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  processId: uuid("process_id").references(() => processes.id),
  // Sem FK cruzando pro schema auth do Supabase — mesmo padrão de
  // profiles.id / processPayables.createdByUserId.
  createdByUserId: uuid("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("purchase_orders_process_idx").on(t.processId),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  sku: text("sku"),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("purchase_order_items_po_idx").on(t.purchaseOrderId),
]);

// Histórico do pedido de compra: cada passo (criação, edição, itens, status,
// packing list, entrada no processo) vira uma linha, com quem fez e quando.
// `eventType` é uma chave fixa (ver lib/purchase-order-events.ts) e
// `description` o detalhe em texto (ex.: "Moeda: USD → EUR").
export const purchaseOrderEvents = pgTable(
  "purchase_order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    description: text("description"),
    // nome/e-mail de quem fez, copiado na hora (o histórico não muda se o perfil mudar)
    userName: text("user_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("purchase_order_events_po_idx").on(t.purchaseOrderId, t.createdAt)],
);

// Arquivos anexados ao pedido de compra — hoje, a Packing List que o fornecedor
// manda. Quando o pedido entra num processo, a packing list vai junto
// (ver syncPackingListToProcess em lib/process-purchase-orders.ts).
export const purchaseOrderDocuments = pgTable("purchase_order_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  docType: documentTypeEnum("doc_type").notNull().default("PACKING_LIST"),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("purchase_order_documents_po_idx").on(t.purchaseOrderId),
]);

// Cotações de frete de um processo: uma por agente de carga (como a proposta
// em PDF que o agente manda, ou as colunas da planilha de comparação). O
// cabeçalho tem os dados do embarque e da carga; os valores ficam em linhas
// (process_freight_quote_lines), cada uma com a própria moeda. Só uma cotação
// por processo fica "escolhida" (isSelected); ao escolher, frete + despesas
// de origem vão para o Frete Internacional do processo.
export const processFreightQuotes = pgTable(
  "process_freight_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processId: uuid("process_id")
      .notNull()
      .references(() => processes.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => freightAgents.id, { onDelete: "set null" }),
    // Referência da proposta do agente (ex: "RKT-014949-26") e a data dela.
    proposal: text("proposal"),
    quoteDate: date("quote_date"),
    // "Validade para embarque" da proposta.
    validUntil: date("valid_until"),
    // Modal estruturado (derivado do tipo de embarque quando dá).
    modal: modalEnum("modal"),
    // Modalidade (MARITIMO | AEREO | TERRESTRE) e tipo de embarque (FCL, LCL,
    // Air Cargo…) como na planilha: "MODAL: SEA/AIR" e "TIPO: FCL/LCL".
    modalidade: text("modalidade"),
    containerType: text("container_type"),
    // Situação da proposta: ATUALIZADO | ANTIGO | FECHADO.
    status: text("status").notNull().default("ATUALIZADO"),
    incoterm: text("incoterm"),
    // Companhia aérea / armador (coluna "CIA" da planilha).
    carrier: text("carrier"),
    origin: text("origin"),
    destination: text("destination"),
    // Rota com escalas (ex: "PKE-CDG-GRU").
    route: text("route"),
    // Trânsito em dias: mínimo e máximo ("de 8 a 15 dias"); só o mínimo = fixo.
    transitDays: integer("transit_days"),
    transitDaysMax: integer("transit_days_max"),
    // Frequência dos embarques (ex: "5 x por semana").
    frequency: text("frequency"),
    // Carga cotada.
    cargoDescription: text("cargo_description"),
    // "Peso considerado" (peso tarifado) da cotação, em kg.
    grossWeightKg: numeric("gross_weight_kg", { precision: 10, scale: 2 }),
    volumes: integer("volumes"),
    volumeM3: numeric("volume_m3", { precision: 10, scale: 3 }),
    dimensions: text("dimensions"),
    cargoValue: numeric("cargo_value", { precision: 14, scale: 2 }),
    cargoValueCurrency: currencyEnum("cargo_value_currency"),
    pickupAddress: text("pickup_address"),
    // DEPRECADAS: substituídas pelas linhas em process_freight_quote_lines.
    // Seguem na tabela só para o deploy antigo continuar lendo sem erro; o
    // código novo não usa — podem ser removidas numa migração futura.
    freightValue: numeric("freight_value", { precision: 12, scale: 2 }),
    freightCurrency: currencyEnum("freight_currency").notNull().default("USD"),
    originFeesValue: numeric("origin_fees_value", { precision: 12, scale: 2 }),
    originFeesCurrency: currencyEnum("origin_fees_currency").notNull().default("USD"),
    destinationFeesValue: numeric("destination_fees_value", { precision: 12, scale: 2 }),
    destinationFeesCurrency: currencyEnum("destination_fees_currency").notNull().default("BRL"),
    otherFeesLabel: text("other_fees_label"),
    otherFeesValue: numeric("other_fees_value", { precision: 12, scale: 2 }),
    otherFeesCurrency: currencyEnum("other_fees_currency").notNull().default("BRL"),
    notes: text("notes"),
    // PDF/planilha da proposta, no bucket de documentos.
    fileName: text("file_name"),
    storagePath: text("storage_path"),
    isSelected: boolean("is_selected").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("process_freight_quotes_process_idx").on(t.processId)],
);

// Seção da proposta a que a linha pertence: frete internacional, despesas na
// origem, despesas no destino ou outras (DTA, custo adicional…).
export const freightQuoteSectionEnum = pgEnum("freight_quote_section", [
  "FRETE",
  "ORIGEM",
  "DESTINO",
  "OUTRAS",
  "RODOVIARIO", // TX DESTINO BLR: transporte rodoviário no destino
]);

// Linha de valor de uma cotação: tarifa × quantidade (com mínimo) = total.
// total é gravado como vem da proposta (alguns itens, como taxa por
// percentual, não se calculam por quantidade × tarifa).
export const processFreightQuoteLines = pgTable(
  "process_freight_quote_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => processFreightQuotes.id, { onDelete: "cascade" }),
    section: freightQuoteSectionEnum("section").notNull(),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }),
    unitPrice: numeric("unit_price", { precision: 12, scale: 4 }),
    // KG | HAWB | PROCESSO | CONTAINER | VOLUME | PERCENT | FIXO
    unit: text("unit"),
    minimum: numeric("minimum", { precision: 12, scale: 2 }),
    currency: currencyEnum("currency").notNull().default("USD"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index("process_freight_quote_lines_quote_idx").on(t.quoteId, t.position)],
);

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
  // Valor unitário (na moeda do processo) pra ratear custo pousado/imposto
  // por item — ver lib/landed-cost.ts. Só precisa ser preenchido quando o
  // item é avulso (sem productId) ou quando o costPrice do catálogo não
  // reflete o valor real desta compra específica; quando vazio, o cálculo
  // usa products.costPrice do item ligado, com fallback pra rateio por
  // quantidade se nenhum dos dois existir.
  unitValueOverride: numeric("unit_value_override", { precision: 12, scale: 2 }),
  // reservedTo (legado, texto livre tipo "1 Joao Sousa / 1 Felipe"): mantido
  // por compatibilidade com os itens já seedados da planilha original.
  // Reservas novas usam itemReservations abaixo (permite múltiplas pessoas
  // reservando quantidades parciais do mesmo item, com disponível calculado).
  reservedTo: text("reserved_to"),
  // Pedido de compra de onde o item veio (um processo/contêiner reúne itens de
  // vários pedidos, de fornecedores diferentes). Vazio = item digitado no
  // processo. Ao desvincular o pedido do processo, estes itens saem junto.
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  // Invoice (do próprio processo) em que o item vem — vazio = não informada.
  invoiceId: uuid("invoice_id").references(() => processInvoices.id, { onDelete: "set null" }),
  // Cobertura cambial do item (sim/não); null = ainda não informado.
  exchangeCoverage: boolean("exchange_coverage"),
  // O produto está com LPCO em consulta pública? null = não informado.
  lpcoPublicConsultation: boolean("lpco_public_consultation"),
  // Nº do LPCO deste item (pode diferir do cadastro do produto).
  lpcoNumber: text("lpco_number"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("process_items_process_idx").on(t.processId),
  index("process_items_purchase_order_idx").on(t.purchaseOrderId),
]);

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
}, (t) => [
  index("item_reservations_item_idx").on(t.itemId),
]);

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
}, (t) => [
  index("process_events_process_date_idx").on(t.processId, t.eventDate.desc()),
]);

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
  // Preenchido quando o documento veio de um pedido de compra (packing list
  // anexada ao pedido); sai junto se o pedido for removido do processo.
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
}, (t) => [
  index("process_documents_process_idx").on(t.processId),
]);

// Tipos de embarque (aba "Tipo de Embarques" da planilha FLUXOGRAMA DE
// IMPORTAÇÃO): modalidade + tipo + descrição. `modalCode` aponta pro valor
// do enum `modal` que o app usa nos processos (vários tipos de FCL 20'/40'
// caem no mesmo SEA_FCL); processes.container_type guarda o nome do tipo.
export const shipmentTypes = pgTable(
  "shipment_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modality: text("modality").notNull(), // MARITIMO | AEREO | TERRESTRE
    name: text("name").notNull(),
    description: text("description"),
    modalCode: text("modal_code"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique("shipment_types_modality_name_unique").on(t.modality, t.name)],
);

// Locais de desembarque/entrega da planilha: portos, aeroportos, terminais
// terrestres e as filiais MCI. O mesmo código pode existir em tipos
// diferentes (ex: NVT = aeroporto e terminal de Navegantes), por isso a
// unicidade é (code, kind).
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    kind: text("kind").notNull(), // PORTO | AEROPORTO | TERMINAL | FILIAL
    name: text("name").notNull(),
    city: text("city"),
    state: text("state"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique("locations_code_kind_unique").on(t.code, t.kind)],
);

// Solicitações de LPCO de um produto, separadas por filial MCI (SP/SC/CE) e
// com histórico — novas solicitações viram novas linhas, nunca sobrescrevem
// as anteriores. O deferimento vale por LPCO_REUSE_DAYS (lib/lpco.ts) a
// partir de approvedAt, contado individualmente em cada filial.
export const productLpcos = pgTable("product_lpcos", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  branch: text("branch").notNull(), // SP | SC | CE
  status: text("status").notNull().default("NAO_SOLICITADO"), // NAO_SOLICITADO | EM_ANALISE | DEFERIDO | INDEFERIDO
  requestedAt: date("requested_at"),
  approvedAt: date("approved_at"),
  // Validade informada (ex: coluna "Validade" da planilha de controle). Vazia =
  // approvedAt + LPCO_REUSE_DAYS.
  validUntil: date("valid_until"),
  lpcoNumber: text("lpco_number"),
  technicalSheet: boolean("technical_sheet"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("product_lpcos_product_idx").on(t.productId),
]);

// Galeria de fotos do produto (pode haver várias). products.photo_url guarda
// a foto principal (a primeira por position) — mantida em sincronia pelas
// actions de produto — pra listas e telas que só precisam de uma imagem.
// sourceUrl: endereço de origem (sem parâmetros) quando a foto veio do site do
// fabricante, pra não baixar a mesma imagem duas vezes.
export const productPhotos = pgTable(
  "product_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("product_photos_product_url_unique").on(t.productId, t.url)],
);
