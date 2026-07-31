// Carrega o catálogo de produtos Aputure da "MCI Pricelist - include deity
// 20260224 (6).xls" (planilha de preços do distribuidor, em USD) para a
// tabela `products`. Rodar com: npx tsx db/seed-aputure-mci.ts
//
// A planilha original mistura Aputure (32 famílias: LS MODIFIERS, LIGHT
// STORM, NOVA*, M-SERIES, ACCENT, AMARAN/Amaran/amaran*, Sidus*, INFINIBAR,
// Storm Series, Spotlight Mount II etc.) com Deity (marca de áudio — 18
// famílias: Accessories, THEOS*, SPD*, SRD Mini*, S-Mic, V-Mic, W.Lav
// Series, IFB, SF1, PR, Charger, TC-1, TC-SL1). db/aputure-mci-data.json já
// contém só as 345 linhas Aputure/Amaran filtradas (fornecedor diferente,
// fora do pedido desta importação).
//
// 28 desses 345 SKUs já existem em `products` (vieram antes da importação
// "BD Itens Amparados Inciso V", com descrições em PT-BR mais ricas) — para
// esses, só o custo é atualizado; descrição/SKU fabricante/fornecedor já
// cadastrados são preservados. Os demais são inserts novos. A comparação de
// SKU é case-insensitive (ex: "FRESNEL F10" na base antiga vs "Fresnel F10"
// nesta planilha são o mesmo produto) — sem isso, uma primeira versão deste
// script criou 9 duplicatas por diferença de maiúsculas/minúsculas.

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql as dsql } from "drizzle-orm";
import { db } from "./client";
import { products, suppliers } from "./schema";

type RawRow = {
  model: string;
  description: string;
  manufacturerSku: string;
  distPrice: number;
  mapPrice: number | null;
  family: string;
};

async function main() {
  const dataPath = path.join(__dirname, "aputure-mci-data.json");
  const rows: RawRow[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  const [aputure] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.name, "APUTURE"));
  if (!aputure) throw new Error('Fornecedor "APUTURE" não encontrado em suppliers.');

  const existing = await db.select({ sku: products.sku }).from(products);
  const existingSkuByLower = new Map(existing.map((p) => [p.sku.toLowerCase(), p.sku]));

  let inserted = 0;
  let updated = 0;
  const toInsert: (typeof products.$inferInsert)[] = [];

  for (const row of rows) {
    const existingSku = existingSkuByLower.get(row.model.toLowerCase());
    if (existingSku) {
      await db
        .update(products)
        .set({
          costPrice: String(row.distPrice),
          costCurrency: "USD",
          updatedAt: new Date(),
        })
        .where(eq(products.sku, existingSku));
      updated++;
    } else {
      toInsert.push({
        sku: row.model,
        manufacturerSku: row.manufacturerSku,
        description: row.description,
        defaultSupplierId: aputure.id,
        costPrice: String(row.distPrice),
        costCurrency: "USD",
        active: true,
      } as typeof products.$inferInsert);
    }
  }

  const CHUNK = 50;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    await db.insert(products).values(chunk);
    inserted += chunk.length;
  }

  console.log(`Inseridos ${inserted} produtos novos.`);
  console.log(`Atualizados ${updated} produtos já existentes (custo).`);

  const [{ count }] = await db.select({ count: dsql<number>`count(*)`.mapWith(Number) }).from(products);
  console.log(`Total de produtos na tabela agora: ${count}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
