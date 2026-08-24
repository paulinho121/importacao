"use client";

import { useState } from "react";

export default function AddPurchaseOrderItemForm({
  action,
  products,
}: {
  action: (formData: FormData) => void;
  products: { id: string; sku: string; description: string; costPrice: string | null }[];
}) {
  const [mode, setMode] = useState<"catalogo" | "avulso">("catalogo");
  const [unitPrice, setUnitPrice] = useState("");

  return (
    <form action={action} className="mt-4 pt-4 border-t border-outline-variant space-y-3">
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
        <select
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
          name="productId"
          required
          defaultValue=""
          onChange={(e) => {
            const opt = e.target.selectedOptions[0];
            const cost = opt?.dataset.cost;
            if (cost) setUnitPrice(cost);
          }}
        >
          <option value="" disabled>
            Selecione um produto do catálogo
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id} data-cost={p.costPrice ?? ""}>
              {p.sku} — {p.description}
            </option>
          ))}
        </select>
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
        className="w-full px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
      >
        Adicionar Item
      </button>
    </form>
  );
}
