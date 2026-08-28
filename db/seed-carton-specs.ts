// Popula products.carton* a partir da "Carton Specs" (Pieces per Carton /
// Length / Height / Width / Weight) da price list do fornecedor —
// db/carton-specs-data.json foi extraído uma vez de "MCI Pricelist
// 20260717.xls" (aba única, cruzamento por products.sku == coluna
// "Model" da planilha, já confirmado 1:1 com manufacturerSku ==
// "System Code"). Reimportar com uma planilha mais nova requer gerar
// esse JSON de novo a partir do arquivo atualizado.
//
// Só faz UPDATE (os produtos já existem no catálogo) — SKU sem
// correspondência no banco é ignorado e contado no resumo final. Rodar
// com: npx tsx db/seed-carton-specs.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "./client";
import { products } from "./schema";
import { eq } from "drizzle-orm";

type RawSpec = {
  sku: string;
  manufacturerSku: string;
  piecesPerCarton: number;
  cartonLengthCm: number;
  cartonWidthCm: number;
  cartonHeightCm: number;
  cartonWeightKg: number;
};

async function main() {
  const dataPath = path.join(__dirname, "carton-specs-data.json");
  const rows: RawSpec[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  let updated = 0;
  let notFound = 0;

  for (const r of rows) {
    const result = await db
      .update(products)
      .set({
        cartonPiecesPerCarton: String(r.piecesPerCarton),
        cartonLengthCm: String(r.cartonLengthCm),
        cartonWidthCm: String(r.cartonWidthCm),
        cartonHeightCm: String(r.cartonHeightCm),
        cartonWeightKg: String(r.cartonWeightKg),
        updatedAt: new Date(),
      })
      .where(eq(products.sku, r.sku))
      .returning({ id: products.id });

    if (result.length > 0) updated++;
    else notFound++;
  }

  console.log(`Atualizados: ${updated}. Sem produto correspondente no catálogo: ${notFound}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
