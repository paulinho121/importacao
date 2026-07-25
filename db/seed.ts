import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { suppliers, processes, processItems } from "./schema";

type RawProcess = {
  processNumber: string;
  fornecedorRaw: string | null;
  processoRaw: string | null;
  currentStep: number;
  modal: string | null;
  invoiceRaw: string | null;
  etd: string | null;
  etaEstimated: string | null;
  agent: string | null;
  destination: string | null;
  weightKg: string | null;
  volumeM3: string | null;
  status: string;
  notes: string | null;
  items: {
    sku: string | null;
    description: string;
    quantity: number | null;
    reservedTo: string | null;
  }[];
};

/**
 * A planilha original usa o mesmo fornecedor com variações de texto
 * ("APUTURE" / "APUTURE (SPARE PARTS)" / "APUTURE + DEARKOL"). Normalizamos
 * para um nome canônico de cadastro; a variação original fica registrada
 * nas observações do processo, nada é descartado.
 */
function normalizeSupplierName(raw: string): { canonical: string; suffix: string | null } {
  const match = raw.match(/^(.*?)\s*(\(|\+|-)\s*(.+)$/);
  if (!match) return { canonical: raw.trim(), suffix: null };
  const canonical = match[1].trim();
  const suffix = raw.trim();
  return { canonical, suffix };
}

async function main() {
  const dataPath = path.join(__dirname, "seed-data.json");
  const raw: RawProcess[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  const supplierIdByName = new Map<string, string>();

  for (const p of raw) {
    if (!p.fornecedorRaw) continue;
    const { canonical } = normalizeSupplierName(p.fornecedorRaw);
    if (supplierIdByName.has(canonical)) continue;

    const [existing] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eqName(canonical));
    if (existing) {
      supplierIdByName.set(canonical, existing.id);
      continue;
    }

    const [created] = await db
      .insert(suppliers)
      .values({ name: canonical, country: "China" })
      .returning({ id: suppliers.id });
    supplierIdByName.set(canonical, created.id);
  }

  let processCount = 0;
  let itemCount = 0;

  for (const p of raw) {
    if (!p.fornecedorRaw) continue;
    const { canonical, suffix } = normalizeSupplierName(p.fornecedorRaw);
    const supplierId = supplierIdByName.get(canonical);
    if (!supplierId) continue;

    const supplierNote =
      suffix && suffix !== canonical ? `Fornecedor (planilha): ${suffix}` : null;
    const notes = [supplierNote, p.notes].filter(Boolean).join(" | ") || null;

    const [createdProcess] = await db
      .insert(processes)
      .values({
        processNumber: p.processNumber,
        externalReference: p.processoRaw?.replace(/\s+/g, " ").trim() ?? null,
        supplierId,
        modal: (p.modal as (typeof processes.$inferInsert)["modal"]) ?? null,
        invoiceNumber: p.invoiceRaw,
        etd: p.etd,
        etaEstimated: p.etaEstimated,
        agent: p.agent,
        destination: p.destination,
        status: p.status as (typeof processes.$inferInsert)["status"],
        currentStep: p.currentStep,
        weightKg: p.weightKg,
        volumeM3: p.volumeM3,
        notes,
      })
      .returning({ id: processes.id });
    processCount++;

    if (p.items.length > 0) {
      await db.insert(processItems).values(
        p.items.map((item) => ({
          processId: createdProcess.id,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity !== null ? String(item.quantity) : null,
          reservedTo: item.reservedTo,
        })),
      );
      itemCount += p.items.length;
    }
  }

  console.log(
    `Seed concluído: ${supplierIdByName.size} fornecedores, ${processCount} processos, ${itemCount} itens.`,
  );
}

function eqName(name: string) {
  return eq(suppliers.name, name);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
