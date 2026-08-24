// Carrega/atualiza o catálogo de produtos Aputure a partir da price list
// mais recente do distribuidor (em USD) para a tabela `products`. Rodar
// com: npx tsx db/seed-aputure-mci.ts
//
// db/aputure-mci-data.json já contém só as linhas Aputure/Amaran (Deity,
// quando presente na planilha original, fica de fora — fornecedor
// diferente). Reimportar com um arquivo mais novo é seguro: produtos já
// cadastrados só têm o custo atualizado (descrição/SKU fabricante/
// fornecedor já cadastrados são preservados); modelos novos na planilha
// viram inserts. Última atualização: MCI Pricelist 20260717.xls (347
// linhas — 21 modelos novos frente à rodada anterior, sem mudança de
// preço nos demais).
//
// A comparação de SKU é case-insensitive (ex: "FRESNEL F10" na base
// antiga vs "Fresnel F10" na planilha são o mesmo produto) — sem isso,
// uma primeira versão deste script criou 9 duplicatas por diferença de
// maiúsculas/minúsculas.

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
