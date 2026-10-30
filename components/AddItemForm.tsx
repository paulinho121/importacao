"use client";

import { useEffect, useRef, useState } from "react";
import { searchProductsForProcess } from "@/app/processos/actions";

type Product = {
  id: string;
  sku: string;
  manufacturerSku: string | null;
  description: string;
  licenseStatus: string | null;
  licenseNumber: string | null;
};

export type InvoiceOption = { id: string; invoiceNumber: string };

const INPUT_CLASS =
  "bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";

export default function AddItemForm({
  action,
  invoices = [],
}: {
  action: (formData: FormData) => void;
  invoices?: InvoiceOption[];
}) {
  const [mode, setMode] = useState<"catalogo" | "avulso">("catalogo");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  // LPCO do item: ao escolher um produto do catálogo, já vem preenchido com
  // o que está cadastrado nele (dá pra ajustar antes de adicionar).
  const [lpcoPublic, setLpcoPublic] = useState("");
  const [lpcoNumber, setLpcoNumber] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef(0);

  // Busca por SKU, SKU do fabricante ou nome, com debounce — só a lista
  // aberta consulta, e respostas antigas (de uma digitação anterior) são
  // descartadas.
  useEffect(() => {
    if (!open) return;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      setLoading(true);
      searchProductsForProcess(search).then((rows) => {
        if (requestId !== requestIdRef.current) return;
        setResults(rows);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, search]);

  function selectProduct(p: Product) {
    setSelected(p);
    setSearch(`${p.sku} — ${p.description}`);
    setLpcoPublic(p.licenseStatus === "EM_CONSULTA_PUBLICA" ? "sim" : "");
    setLpcoNumber(p.licenseNumber ?? "");
    setOpen(false);
  }

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
        // Espera o FormData ser lido antes de limpar os campos.
        setTimeout(() => {
          formRef.current?.reset();
          setSearch("");
          setSelected(null);
          setResults([]);
          setLpcoPublic("");
          setLpcoNumber("");
        }, 0);
      }}
    >
      <div className="flex gap-2">
        {(["catalogo", "avulso"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
              mode === m
                ? "bg-secondary text-on-secondary"
                : "border border-outline-variant text-on-surface-variant"
            }`}
          >
            {m === "catalogo" ? "Do catálogo" : "Item avulso"}
          </button>
        ))}
      </div>

      <select className={`w-full appearance-none ${INPUT_CLASS}`} name="invoiceId" defaultValue="" aria-label="Invoice">
        <option value="">Invoice (opcional)</option>
        {invoices.map((inv) => (
          <option key={inv.id} value={inv.id}>
            Invoice {inv.invoiceNumber}
          </option>
        ))}
      </select>

      {mode === "catalogo" ? (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">
            search
          </span>
          <input
            ref={inputRef}
            className={`w-full pl-11 pr-9 ${INPUT_CLASS}`}
            type="text"
            placeholder="Buscar por SKU, SKU do fabricante ou nome..."
            aria-label="Buscar produto do catálogo"
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
                <span>Catálogo de produtos</span>
                <span>
                  {loading
                    ? "Buscando..."
                    : `${results.length}${results.length === 40 ? "+" : ""} ${results.length === 1 ? "item" : "itens"}`}
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
                      className="w-full text-left px-3 py-2 hover:bg-surface-container-high text-body-sm font-body-sm border-b border-outline-variant/50 last:border-0 transition-colors"
                    >
                      <span className="font-mono-data text-xs text-secondary">{p.sku}</span>
                      {p.manufacturerSku && p.manufacturerSku !== p.sku && (
                        <span className="ml-2 font-mono-data text-xs text-outline">
                          Fab.: {p.manufacturerSku}
                        </span>
                      )}
                      <span className="block text-on-surface-variant truncate">{p.description}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input
            className={`col-span-2 ${INPUT_CLASS}`}
            placeholder="Descrição do item"
            type="text"
            name="description"
            required
          />
          <input
            className={`col-span-2 font-mono-data ${INPUT_CLASS}`}
            placeholder="SKU (opcional)"
            type="text"
            name="sku"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input className={INPUT_CLASS} placeholder="Quantidade" type="number" step="0.01" name="quantity" />
        <input
          className={INPUT_CLASS}
          placeholder="Valor unitário"
          type="number"
          step="0.01"
          name="unitValueOverride"
          aria-label="Valor unitário"
        />
        <select className={`appearance-none ${INPUT_CLASS}`} name="exchangeCoverage" defaultValue="" aria-label="Cobertura cambial">
          <option value="">Cobertura cambial?</option>
          <option value="sim">Cobertura cambial: Sim</option>
          <option value="nao">Cobertura cambial: Não</option>
        </select>
        <select
          className={`appearance-none ${INPUT_CLASS}`}
          name="lpcoPublicConsultation"
          value={lpcoPublic}
          onChange={(e) => setLpcoPublic(e.target.value)}
          aria-label="LPCO em consulta pública"
        >
          <option value="">LPCO em consulta pública?</option>
          <option value="sim">LPCO consulta pública: Sim</option>
          <option value="nao">LPCO consulta pública: Não</option>
        </select>
        <input
          className={`col-span-2 font-mono-data ${INPUT_CLASS}`}
          placeholder="LPCO do item (nº)"
          type="text"
          name="lpcoNumber"
          value={lpcoNumber}
          onChange={(e) => setLpcoNumber(e.target.value)}
        />
        <input
          className={`col-span-2 ${INPUT_CLASS}`}
          placeholder="Reservado para (opcional)"
          type="text"
          name="reservedTo"
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
