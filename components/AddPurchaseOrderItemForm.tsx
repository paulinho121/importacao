"use client";

import { useEffect, useRef, useState } from "react";
import { searchPurchaseOrderProducts } from "@/app/pedidos-compra/actions";
import { checkExternalImportMatch } from "@/app/em-importacao/actions";
import { resolveTieredPrice, type PriceTier } from "@/lib/price-tiers";
import {
  EXTERNAL_IMPORT_ITEM_STATUS_LABEL,
  formatDate,
  type ExternalImportItemStatus,
} from "@/lib/status";

type Product = { id: string; sku: string; description: string; costPrice: string | null; priceTiers: PriceTier[] };

type ExternalMatch = {
  id: string;
  sku: string | null;
  description: string;
  quantity: string | null;
  processNumber: string | null;
  status: string | null;
  eta: string | null;
};

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
  const [quantity, setQuantity] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [avulsoDescription, setAvulsoDescription] = useState("");
  const [avulsoSku, setAvulsoSku] = useState("");
  const [externalMatches, setExternalMatches] = useState<ExternalMatch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchRequestIdRef = useRef(0);

  // Avisa (sem bloquear) quando o item que está sendo adicionado ao
  // pedido já aparece no controle externo de itens em importação —
  // dispara ao selecionar um produto do catálogo, e com debounce ao
  // digitar descrição/SKU no modo avulso.
  useEffect(() => {
    const sku = mode === "catalogo" ? (selected?.sku ?? null) : avulsoSku || null;
    const description = mode === "catalogo" ? (selected?.description ?? "") : avulsoDescription;

    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    const requestId = ++matchRequestIdRef.current;
    matchDebounceRef.current = setTimeout(() => {
      if (!sku && description.trim().length < 4) {
        setExternalMatches([]);
        return;
      }
      checkExternalImportMatch(sku, description).then((rows) => {
        if (requestId !== matchRequestIdRef.current) return;
        setExternalMatches(rows);
      });
    }, 300);

    return () => {
      if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    };
  }, [mode, selected, avulsoSku, avulsoDescription]);

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
    const price = resolveTieredPrice(p.priceTiers, quantity ? Number(quantity) : null, p.costPrice);
    if (price) setUnitPrice(price);
  }

  function handleQuantityChange(value: string) {
    setQuantity(value);
    if (selected) {
      const price = resolveTieredPrice(selected.priceTiers, value ? Number(value) : null, selected.costPrice);
      if (price) setUnitPrice(price);
    }
  }

  const appliedTier =
    selected && quantity
      ? selected.priceTiers
          .filter((t) => Number(t.minQuantity) <= Number(quantity))
          .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity))[0]
      : null;

  function clearSelection() {
    setSelected(null);
    setSearch("");
    setOpen(true);
    inputRef.current?.focus();
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="mt-4 pt-4 border-t border-outline-variant space-y-3"
      onSubmit={(e) => {
        if (mode === "catalogo" && !selected) {
          e.preventDefault();
          return;
        }
        // Espera o FormData ser capturado pro envio antes de limpar os
        // campos — resetar no mesmo tick apagaria os valores antes de
        // serem lidos pela Server Action.
        setTimeout(() => {
          formRef.current?.reset();
          setSearch("");
          setSelected(null);
          setUnitPrice("");
          setQuantity("");
          setResults([]);
          setAvulsoDescription("");
          setAvulsoSku("");
          setExternalMatches([]);
          if (mode === "catalogo") inputRef.current?.focus();
        }, 0);
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
            value={avulsoDescription}
            onChange={(e) => setAvulsoDescription(e.target.value)}
            required
          />
          <input
            className="col-span-2 bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="SKU (opcional)"
            type="text"
            name="sku"
            value={avulsoSku}
            onChange={(e) => setAvulsoSku(e.target.value)}
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
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
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

      {appliedTier && (
        <p className="text-xs text-secondary flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">local_offer</span>
          Preço por volume aplicado: a partir de {Number(appliedTier.minQuantity)} un.
        </p>
      )}

      {externalMatches.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
          <p className="text-xs font-label-md text-warning flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Este item já aparece em &quot;Em Importação (Externo)&quot;:
          </p>
          <ul className="space-y-1.5">
            {externalMatches.map((m) => (
              <li key={m.id} className="text-xs font-body-sm text-on-surface-variant leading-snug">
                <span className="font-mono-data text-on-surface">{m.sku ?? "sem SKU"}</span> — {m.description}
                {" · "}
                Qtd: {m.quantity ?? "—"}
                {" · "}
                Processo: {m.processNumber ?? "—"}
                {" · "}
                {m.status
                  ? EXTERNAL_IMPORT_ITEM_STATUS_LABEL[m.status as ExternalImportItemStatus]
                  : "Sem status"}
                {m.eta ? ` · ETA: ${formatDate(m.eta)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

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
