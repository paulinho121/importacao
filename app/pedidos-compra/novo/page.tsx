import AppShell from "@/components/AppShell";
import { createPurchaseOrder } from "@/app/pedidos-compra/actions";
import { db } from "@/db/client";
import { suppliers, purchaseOrders, companyBranches } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { CURRENCIES } from "@/lib/currencies";
import { INCOTERMS } from "@/lib/incoterms";

export const dynamic = "force-dynamic";

async function suggestPoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(purchaseOrders);
  return `PO-${year}-${String(count + 1).padStart(3, "0")}`;
}

export default async function NovoPedidoCompraPage() {
  const [supplierRows, branchRows, suggestedNumber] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name),
    db.select().from(companyBranches).orderBy(desc(companyBranches.isDefault), companyBranches.name),
    suggestPoNumber(),
  ]);
  const defaultBranch = branchRows.find((b) => b.isDefault) ?? branchRows[0];

  return (
    <AppShell title="Novo Pedido de Compra">
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="font-display-lg text-display-lg text-primary">Novo Pedido de Compra</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Cria o pedido em &ldquo;Rascunho&rdquo; — adicione os itens na tela seguinte antes de
            enviar pro fornecedor.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <form action={createPurchaseOrder} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Número do Pedido
                </label>
                <input
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
                  type="text"
                  name="poNumber"
                  defaultValue={suggestedNumber}
                  required
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Fornecedor
                </label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                  name="supplierId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione o fornecedor
                  </option>
                  {supplierRows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Comprador (sua empresa)
                </label>
                {branchRows.length === 0 ? (
                  <p className="text-body-sm font-body-sm text-on-surface-variant p-3 bg-surface-container-low border border-outline-variant rounded-lg">
                    Nenhuma filial cadastrada — adicione em Configurações.
                  </p>
                ) : (
                  <select
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                    name="branchId"
                    defaultValue={defaultBranch?.id ?? ""}
                  >
                    {branchRows.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.cnpj}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Moeda
                </label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                  name="currency"
                  defaultValue=""
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Incoterm
                </label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                  name="incoterm"
                  defaultValue=""
                >
                  <option value="">Selecione</option>
                  {INCOTERMS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Entrega Prevista
                </label>
                <input
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                  type="date"
                  name="expectedDeliveryDate"
                />
              </div>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Observações
              </label>
              <textarea
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                name="notes"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-4 pt-2">
              <button
                type="submit"
                className="px-8 py-3 rounded-lg bg-secondary text-white font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                Criar Pedido
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
