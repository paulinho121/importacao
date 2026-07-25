import AppShell from "@/components/AppShell";
import ProductForm from "@/components/ProductForm";
import { createProduct } from "@/app/produtos/actions";
import { db } from "@/db/client";
import { suppliers } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function NovoProdutoPage() {
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .orderBy(suppliers.name);

  return (
    <AppShell title="Novo Produto">
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="font-display-lg text-display-lg text-primary">
            Cadastro de Produto
          </h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Adicionar produto ao catálogo, com NCM e SKU do fabricante.
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <ProductForm
            action={createProduct}
            submitLabel="Cadastrar Produto"
            suppliers={supplierRows}
          />
        </div>
      </div>
    </AppShell>
  );
}
