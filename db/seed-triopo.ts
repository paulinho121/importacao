// Carrega/atualiza o catálogo de produtos TRIOPO a partir da price list do
// distribuidor (em USD) para a tabela `products`. Rodar com:
// npx tsx db/seed-triopo.ts
//
// db/triopo-data.json foi extraído diretamente do PDF original
// ("TRIOPO full products price list .pdf", 27 páginas) — não do xlsx que o
// usuário converteu à mão, que tinha ~20 produtos faltando e colunas
// desalinhadas. A extração usa a posição real do texto na página (não a
// ordem do texto), já que o PDF mistura pelo menos 3 layouts de tabela
// diferentes ao longo do documento. TRIOPO não tem um código de SKU do
// fabricante separado do nome do modelo — por isso sku e manufacturerSku
// usam o mesmo valor. Reimportar é seguro: produtos já cadastrados só têm
// o custo atualizado; modelos novos na planilha viram inserts.

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql as dsql } from "drizzle-orm";
import { db } from "./client";
import { products, suppliers } from "./schema";

type RawRow = {
  model: string;
  price: number;
};

async function main() {
  const dataPath = path.join(__dirname, "triopo-data.json");
  const rows: RawRow[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  const [triopo] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, "Triopo"));
  if (!triopo) throw new Error('Fornecedor "Triopo" não encontrado em suppliers.');

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
          costPrice: String(row.price),
          costCurrency: "USD",
          updatedAt: new Date(),
        })
        .where(eq(products.sku, existingSku));
      updated++;
    } else {
      toInsert.push({
        sku: row.model,
        manufacturerSku: row.model,
        description: row.model,
        defaultSupplierId: triopo.id,
        costPrice: String(row.price),
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
