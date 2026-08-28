import { estimateItems, suggestContainers, type ItemEstimateInput } from "@/lib/container-estimate";

export default function ContainerEstimate({ items }: { items: ItemEstimateInput[] }) {
  const results = estimateItems(items);
  const withSpecs = results.filter((r) => !r.missingSpecs);
  const missingSpecs = results.filter((r) => r.missingSpecs);

  if (results.length === 0) return null;

  const totalCbm = withSpecs.reduce((sum, r) => sum + (r.cbm ?? 0), 0);
  const totalWeightKg = withSpecs.reduce((sum, r) => sum + (r.weightKg ?? 0), 0);
  const totalCartons = withSpecs.reduce((sum, r) => sum + (r.cartons ?? 0), 0);

  const suggestions = totalCbm > 0 ? suggestContainers(totalCbm, totalWeightKg) : [];

  return (
    <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-1">Estimativa de Container</h3>
      <p className="text-xs text-on-surface-variant mb-4">
        Calculado a partir da cubagem de carton cadastrada no catálogo (Produtos → Especificações de
        Carton). Capacidades por tipo de container são valores práticos de mercado — trate como
        estimativa, não como número garantido pelo armador.
      </p>

      {withSpecs.length === 0 ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">
          Nenhum item do pedido tem especificações de carton cadastradas ainda.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-surface-container-low rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary font-mono-data">{totalCartons}</p>
              <p className="text-xs text-on-surface-variant">Cartons</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary font-mono-data">
                {totalCbm.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-on-surface-variant">m³ (CBM)</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary font-mono-data">
                {totalWeightKg.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-on-surface-variant">kg brutos</p>
            </div>
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-xs">
                  <th className="py-2 pr-3 font-label-md">CONTAINER</th>
                  <th className="py-2 pr-3 font-label-md text-right">NECESSÁRIOS</th>
                  <th className="py-2 pr-3 font-label-md text-right">LIMITADO POR</th>
                  <th className="py-2 font-label-md text-right">OCUPAÇÃO (VOL. / PESO)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {suggestions.map((s) => (
                  <tr key={s.type}>
                    <td className="py-2 pr-3 font-body-sm">{s.label}</td>
                    <td className="py-2 pr-3 text-right font-bold text-primary font-mono-data">
                      {s.containersNeeded}
                    </td>
                    <td className="py-2 pr-3 text-right text-on-surface-variant capitalize">{s.boundBy}</td>
                    <td className="py-2 text-right font-mono-data text-on-surface-variant">
                      {s.volumeUtilizationPct}% / {s.weightUtilizationPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="text-body-sm font-body-sm">
            <summary className="cursor-pointer text-secondary hover:underline">
              Ver detalhamento por item
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant">
                    <th className="py-2 pr-3 font-label-md">ITEM</th>
                    <th className="py-2 pr-3 font-label-md text-right">QTD</th>
                    <th className="py-2 pr-3 font-label-md text-right">CARTONS</th>
                    <th className="py-2 pr-3 font-label-md text-right">CBM</th>
                    <th className="py-2 font-label-md text-right">KG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 font-mono-data">
                  {withSpecs.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-body-sm">{r.description}</td>
                      <td className="py-2 pr-3 text-right">{r.quantity}</td>
                      <td className="py-2 pr-3 text-right">{r.cartons}</td>
                      <td className="py-2 pr-3 text-right">{(r.cbm ?? 0).toFixed(3)}</td>
                      <td className="py-2 text-right">{(r.weightKg ?? 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      {missingSpecs.length > 0 && (
        <p className="mt-4 text-xs text-on-surface-variant flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-warning shrink-0">info</span>
          Fora da conta acima ({missingSpecs.length}{" "}
          {missingSpecs.length === 1 ? "item" : "itens"} sem especificação de carton cadastrada):{" "}
          {missingSpecs.map((r) => r.description).join(", ")}.
        </p>
      )}
    </section>
  );
}
