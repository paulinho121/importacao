"use client";

import { useEffect, useRef, useState } from "react";
import { searchPurchaseOrderProducts } from "@/app/pedidos-compra/actions";

type Product = { id: string; sku: string; description: string; costPrice: string | null };

export default function AddPurchaseOrderItemForm({
  action,
  supplierId,
  supplierName,
  hasProducts,
}: {
  action: (formData: FormData) => void;
  supplierId: string;
  supplierName: string;
  hasProducts: boolean;
}) {
  const [mode, setMode] = useState<"catalogo" | "avulso">("catalogo");
  const [unitPrice, setUnitPrice] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchPurchaseOrderProducts(supplierId, search).then((rows) => {
        if (requestId !== requestIdRef.current) return; // resposta antiga, ignora
        setResults(rows);
        setLoading(false);
      });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, search, supplierId]);

  function selectProduct(p: Product) {
    setSelected(p);
    setSearch(`${p.sku} — ${p.description}`);
    setOpen(false);
    if (p.costPrice) setUnitPrice(p.costPrice);
  }

  function clearSelection() {
    setSelected(null);
    setSearch("");
    setOpen(true);
    inputRef.current?.focus();
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
        !hasProducts ? (
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            Nenhum produto do catálogo tem este fornecedor como padrão. Use &quot;Item avulso&quot; ou
            ajuste o fornecedor padrão do produto em Produtos.
          </p>
        ) : (
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">
              search
            </span>
            <input
              ref={inputRef}
              className="w-full pl-11 pr-9 bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
              type="text"
              placeholder={`Buscar item de ${supplierName} por SKU ou nome...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
                setOpen(true);
              }}
              onFocus={(e) => {
                setOpen(true);
                if (selected) e.target.select();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  inputRef.current?.blur();
                }
              }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {search && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearSelection}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            <input type="hidden" name="productId" value={selected?.id ?? ""} />

            {open && (
              <div className="absolute z-10 mt-1 w-full bg-surface-container border border-outline-variant rounded-lg shadow-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-surface-container-low border-b border-outline-variant text-xs font-label-md text-on-surface-variant flex justify-between">
                  <span>{supplierName}</span>
                  <span>
                    {loading ? "Buscando..." : `${results.length}${results.length === 50 ? "+" : ""} ${results.length === 1 ? "item" : "itens"}`}
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {!loading && results.length === 0 ? (
                    <p className="p-3 text-body-sm font-body-sm text-on-surface-variant">
                      Nenhum produto encontrado.
                    </p>
                  ) : (
                    results.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectProduct(p)}
                        className={`w-full text-left px-3 py-2 hover:bg-surface-container-high text-body-sm font-body-sm border-b border-outline-variant/50 last:border-0 transition-colors ${
                          selected?.id === p.id ? "bg-secondary/10" : ""
                        }`}
                      >
                        <span className="font-mono-data text-xs text-secondary">{p.sku}</span>
                        <span className="block text-on-surface-variant truncate">{p.description}</span>
                      </button>
                    ))
                  )}
                </div>
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
