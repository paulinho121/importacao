import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * Script de limpeza para entrada em Produção:
 * Zera todos os Pedidos de Compra e Processos de Importação (e suas tabelas filhas),
 * preservando integralmente o Catálogo de Produtos, Fornecedores, Agentes, Filiais e Usuários.
 *
 * Modo de uso:
 * 1. Simulação (Dry Run):
 *    npx tsx db/reset-orders-and-processes.ts --dry-run
 *
 * 2. Execução Real:
 *    npx tsx db/reset-orders-and-processes.ts --execute
 */

async function main() {
  const isExecute = process.argv.includes("--execute");
  const isDryRun = process.argv.includes("--dry-run") || !isExecute;

  console.log("==================================================================");
  console.log(" IMPORTFLOW TMS - LIMPEZA DE PEDIDOS E PROCESSOS PARA PRODUÇÃO");
  console.log("==================================================================");
  console.log(`Modo: ${isExecute ? "⚠️  EXECUÇÃO REAL" : "🔍 SIMULAÇÃO (DRY-RUN)"}\n`);

  // Tabelas que serão zeradas (Ordem de dependência caso não seja TRUNCATE CASCADE)
  const tablesToClear = [
    // Filhos de Pedidos de Compra
    { name: "purchase_order_documents", label: "Documentos de Pedidos de Compra" },
    { name: "purchase_order_events", label: "Eventos/Histórico de Pedidos de Compra" },
    { name: "purchase_order_items", label: "Itens de Pedidos de Compra" },
    
    // Filhos de Processos de Importação
    { name: "item_reservations", label: "Reservas de Itens de Processo" },
    { name: "process_items", label: "Itens de Processos" },
    { name: "process_documents", label: "Documentos de Processos" },
    { name: "process_events", label: "Eventos/Histórico de Processos" },
    { name: "process_payables", label: "Contas a Pagar dos Processos" },
    { name: "process_lpcos", label: "LPCOs Operacionais dos Processos" },
    { name: "process_invoices", label: "Invoices dos Processos" },
    { name: "process_freight_quote_lines", label: "Linhas de Cotação de Frete" },
    { name: "process_freight_quotes", label: "Cotações de Frete" },
    { name: "process_supplier_quote_items", label: "Itens de Cotação de Fornecedor" },
    { name: "process_supplier_quotes", label: "Cotações de Fornecedor" },
    { name: "process_quote_events", label: "Histórico de Cotações" },

    // Tabelas Principais
    { name: "purchase_orders", label: "Pedidos de Compra" },
    { name: "processes", label: "Processos de Importação" },
  ];

  // Tabelas que SERÃO PRESERVADAS (para conferência)
  const tablesPreserved = [
    { name: "products", label: "Catálogo Mestre de Produtos" },
    { name: "product_price_tiers", label: "Faixas de Preço por Quantidade (MOQ)" },
    { name: "product_photos", label: "Galeria de Fotos dos Produtos" },
    { name: "product_lpcos", label: "LPCOs de Produtos por Filial" },
    { name: "suppliers", label: "Fornecedores" },
    { name: "freight_agents", label: "Agentes de Carga" },
    { name: "company_branches", label: "Filiais da Empresa" },
    { name: "profiles", label: "Usuários e Perfis de Acesso" },
    { name: "shipment_types", label: "Tipos de Embarque Cadastrados" },
    { name: "locations", label: "Portos, Aeroportos e Locais" },
  ];

  console.log("📊 Contagem atual nas tabelas operacionais a serem ZERADAS:");
  let totalOperacional = 0;
  for (const t of tablesToClear) {
    try {
      const result: any = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM "${t.name}"`));
      const count = result.rows?.[0]?.count ?? result[0]?.count ?? 0;
      console.log(`  - ${t.label} (${t.name}): ${count} registros`);
      totalOperacional += count;
    } catch (err: any) {
      console.warn(`  - ${t.name}: não foi possível contar (${err.message})`);
    }
  }

  console.log(`\n📦 Total de registros operacionais encontrados: ${totalOperacional}\n`);

  console.log("🛡️  Contagem atual nas tabelas mestres que SERÃO PRESERVADAS:");
  for (const t of tablesPreserved) {
    try {
      const result: any = await db.execute(sql.raw(`SELECT COUNT(*)::int as count FROM "${t.name}"`));
      const count = result.rows?.[0]?.count ?? result[0]?.count ?? 0;
      console.log(`  - ${t.label} (${t.name}): ${count} registros mantidos`);
    } catch (err: any) {
      console.warn(`  - ${t.name}: não foi possível contar (${err.message})`);
    }
  }

  if (isDryRun) {
    console.log("\n------------------------------------------------------------------");
    console.log("ℹ️  Modo SIMULAÇÃO concluído. Nenhum dado foi alterado.");
    console.log("Para efetuar a limpeza definitiva no banco de dados, execute:");
    console.log("   npx tsx db/reset-orders-and-processes.ts --execute");
    console.log("------------------------------------------------------------------\n");
    process.exit(0);
  }

  console.log("\n⚠️  INICIANDO LIMPEZA DEFINITIVA...");

  // Realiza a limpeza em uma única transação segura
  try {
    await db.execute(sql`
      BEGIN;

      -- Desconecta pedidos e processos antes da deleção para evitar travas de FK circular
      UPDATE purchase_orders SET process_id = NULL;

      -- Truncate em cascata em todas as tabelas de pedidos e processos
      TRUNCATE TABLE
        purchase_order_documents,
        purchase_order_events,
        purchase_order_items,
        purchase_orders,
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
    `);

    console.log("\n✅ LIMPEZA CONCLUÍDA COM SUCESSO!");
    console.log("Todos os pedidos de compra, processos e movimentações foram zerados.");
    console.log("Seu catálogo de produtos, fornecedores e cadastros-base permanecem 100% intactos.\n");
  } catch (error: any) {
    console.error("\n❌ ERRO durante a limpeza:", error.message);
    try {
      await db.execute(sql`ROLLBACK;`);
    } catch {}
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Falha fatal ao executar script:", err);
  process.exit(1);
});
