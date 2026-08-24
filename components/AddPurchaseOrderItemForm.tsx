"use client";

import { useMemo, useState } from "react";

type Product = { id: string; sku: string; description: string; costPrice: string | null };

export default function AddPurchaseOrderItemForm({
  action,
  products,
}: {
  action: (formData: FormData) => void;
  products: Product[];
}) {
  const [mode, setMode] = useState<"catalogo" | "avulso">("catalogo");
  const [unitPrice, setUnitPrice] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (query.length < 2) return [];
    return products
      .filter((p) => p.sku.toLowerCase().includes(query) || p.description.toLowerCase().includes(query))
      .slice(0, 50);
  }, [products, query]);

  function selectProduct(p: Product) {
    setSelected(p);
    setSearch(`${p.sku} — ${p.description}`);
    setOpen(false);
    if (p.costPrice) setUnitPrice(p.costPrice);
  }

  return (
    <form
      action={action}
      className="mt-4 pt-4 border-t border-outline-variant space-y-3"
      onSubmit={(e) => {
        if (mode === "catalogo" && !selected) e.preventDefault();
      }}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("catalogo")}
          className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
            mode === "catalogo"
              ? "bg-secondary text-on-secondary"
              : "border border-outline-variant text-on-surface-variant"
          }`}
        >
          Do catálogo
        </button>
        <button
          type="button"
          onClick={() => setMode("avulso")}
          className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
            mode === "avulso"
              ? "bg-secondary text-on-secondary"
              : "border border-outline-variant text-on-surface-variant"
          }`}
        >
          Item avulso
        </button>
      </div>

      {mode === "catalogo" ? (
        products.length === 0 ? (
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            Nenhum produto do catálogo tem este fornecedor como padrão. Use &quot;Item avulso&quot; ou
            ajuste o fornecedor padrão do produto em Produtos.
          </p>
        ) : (
          <div className="relative">
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
              type="text"
              placeholder="Buscar por SKU ou nome do produto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            <input type="hidden" name="productId" value={selected?.id ?? ""} />

            {open && query.length > 0 && query.length < 2 && (
              <p className="absolute z-10 mt-1 px-1 text-xs text-on-surface-variant">
                Digite ao menos 2 caracteres para buscar.
              </p>
            )}

            {open && query.length >= 2 && (
              <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-surface-container border border-outline-variant rounded-lg shadow-lg">
                {filtered.length === 0 ? (
                  <p className="p-3 text-body-sm font-body-sm text-on-surface-variant">
                    Nenhum produto encontrado.
                  </p>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-surface-container-high text-body-sm font-body-sm border-b border-outline-variant/50 last:border-0 transition-colors"
                    >
                      <span className="font-mono-data">{p.sku}</span> — {p.description}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input
            className="col-span-2 bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
            placeholder="Descrição do item"
            type="text"
            name="description"
            required
          />
          <input
            className="col-span-2 bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="SKU (opcional)"
            type="text"
            name="sku"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          placeholder="Quantidade"
          type="number"
          step="0.01"
          name="quantity"
        />
        <input
          className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
          placeholder="Preço unitário"
          type="number"
          step="0.01"
          name="unitPrice"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={mode === "catalogo" && !selected}
        className="w-full px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Adicionar Item
      </button>
    </form>
  );
}
