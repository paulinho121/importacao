import type { LandedCostItemResult } from "@/lib/landed-cost";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export default function LandedCostBreakdown({
  items,
  usedFallbackQuantity,
}: {
  items: LandedCostItemResult[] | null;
  usedFallbackQuantity: boolean;
}) {
  return (
    <div className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-1">Custo Pousado</h3>
      <p className="text-xs text-on-surface-variant mb-4">
        Rateio do Valor Aduaneiro + contas a pagar + tributos por item — calculado a cada
        visita, nunca gravado (sempre reflete o câmbio/contas atuais).
      </p>

      {items === null ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">
          Preencha câmbio e ao menos 1 invoice em &ldquo;Financeiro do Processo&rdquo; pra calcular.
        </p>
      ) : items.length === 0 ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">Nenhum item registrado.</p>
      ) : (
        <>
          {usedFallbackQuantity && (
            <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg p-2 mb-3">
              Nenhum item tem valor de compra (nem no catálogo, nem &ldquo;Valor unitário&rdquo; manual) — rateando por
              quantidade em vez de valor. Preencha o valor unitário dos itens pra um rateio mais preciso.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant">
                  <th className="py-2 pr-3 font-label-md">ITEM</th>
                  <th className="py-2 pr-3 font-label-md text-right">VALOR FOB</th>
                  <th className="py-2 pr-3 font-label-md text-right">PARTIC.</th>
                  <th className="py-2 pr-3 font-label-md text-right">TRIBUTOS</th>
                  <th className="py-2 pr-3 font-label-md text-right">CUSTO POUSADO</th>
                  <th className="py-2 font-label-md text-right">UNITÁRIO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 font-mono-data">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 font-body-sm max-w-[180px] truncate" title={item.description}>
                      {item.sku ?? item.description}
                    </td>
                    <td className="py-2 pr-3 text-right">{brl.format(item.valorFOB)}</td>
                    <td className="py-2 pr-3 text-right">{pct.format(item.participacaoPct)}%</td>
                    <td className="py-2 pr-3 text-right" title={`II ${brl.format(item.taxes.ii)} · IPI ${brl.format(item.taxes.ipi)} · PIS ${brl.format(item.taxes.pis)} · COFINS ${brl.format(item.taxes.cofins)} · ICMS ${brl.format(item.taxes.icms)}`}>
                      {brl.format(item.taxes.total)}
                    </td>
                    <td className="py-2 pr-3 text-right font-bold text-primary">
                      {brl.format(item.custoPousadoTotal)}
                    </td>
                    <td className="py-2 text-right">{brl.format(item.custoPousadoUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
