// Cadastra as filiais da Multicomercial e Importadora LTDA (matriz +
// filiais, mesmo grupo, CNPJs diferentes) — usadas como "Comprador" ao
// criar um pedido de compra. Idempotente: já existindo o CNPJ, só atualiza
// nome/endereço.
//
// Rodar com: npx tsx db/seed-company-branches.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./client";
import { companyBranches } from "./schema";
import { eq } from "drizzle-orm";

const BRANCHES = [
  {
    name: "Multicomercial e Importadora LTDA",
    cnpj: "05.502.390/0001-11",
    address: "Rua Senador Pompeu, 1547, Centro, CEP 60.025-001, Fortaleza - CE",
    isDefault: true,
  },
  {
    name: "Multicomercial e Importadora LTDA",
    cnpj: "05.502.390/0002-00",
    address: "Rua Odilio Garcia, 211, SALA B, BOX 10, Bairro: Cordeiros, CEP 88.310-180, Itajaí, Santa Catarina",
    isDefault: false,
  },
  {
    name: "Multicomercial e Importadora LTDA",
    cnpj: "05.502.390/0003-83",
    address: "Av. Imperatriz Leopoldina, 1718 - 2º andar, Vila Leopoldina, CEP 05305-003, São Paulo - SP",
    isDefault: false,
  },
];

async function main() {
  let inserted = 0;
  let updated = 0;

  for (const branch of BRANCHES) {
    const [existing] = await db.select().from(companyBranches).where(eq(companyBranches.cnpj, branch.cnpj));
    if (existing) {
      await db
        .update(companyBranches)
        .set({ name: branch.name, address: branch.address, isDefault: branch.isDefault, updatedAt: new Date() })
        .where(eq(companyBranches.id, existing.id));
      updated++;
    } else {
      await db.insert(companyBranches).values(branch);
      inserted++;
    }
  }

  console.log(`Filiais inseridas: ${inserted}, atualizadas: ${updated}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
