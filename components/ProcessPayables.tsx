import { PAYABLE_CATEGORY_LABEL, formatDate, diasRestantes, type PayableCategory } from "@/lib/status";
import { PAYABLE_CURRENCIES } from "@/lib/currencies";
import { markPayableAsPaid } from "@/app/financeiro/actions";

const CATEGORIES: PayableCategory[] = [
  "FORNECEDOR",
  "FRETE",
  "SEGURO",
  "DESEMBARACO",
  "ARMAZENAGEM",
  "IMPOSTO",
  "OUTRO",
];

export type PayableData = {
  id: string;
  category: PayableCategory;
  description: string;
  amount: string;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
};

export default function ProcessPayables({
  payables,
  createPayableAction,
  canEdit,
}: {
  payables: PayableData[];
  createPayableAction: (formData: FormData) => void;
  canEdit: boolean;
}) {
  return (
    <div className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">Contas a Pagar</h3>

      {payables.length === 0 ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm mb-4">
          Nenhuma conta registrada pra este processo.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {payables.map((p) => {
            const dias = p.paidAt ? null : diasRestantes(p.dueDate);
            const vencida = dias !== null && dias < 0;
            const boundMarkPaid = markPayableAsPaid.bind(null, p.id);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 text-body-sm font-body-sm border-b border-outline-variant/50 pb-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-primary truncate">
                    {PAYABLE_CATEGORY_LABEL[p.category]} — {p.description}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {Number(p.amount).toFixed(2)} {p.currency}
                    {p.dueDate && ` · Vence ${formatDate(p.dueDate)}`}
                    {p.paidAt && ` · Pago em ${formatDate(p.paidAt)}`}
                  </p>
                </div>
                {p.paidAt ? (
                  <span className="shrink-0 px-2 py-1 rounded-full text-xs bg-tertiary-fixed text-on-tertiary-fixed-variant">
                    Pago
                  </span>
                ) : (
                  <div className="shrink-0 flex items-center gap-2">
                    {vencida && (
                      <span className="px-2 py-1 rounded-full text-xs bg-error-container text-on-error-container">
                        Vencida
                      </span>
                    )}
                    {canEdit && (
                      <form action={boundMarkPaid}>
                        <button
                          type="submit"
                          className="px-2 py-1 rounded-lg text-xs text-secondary hover:bg-secondary/10 transition-colors"
                        >
                          Marcar como paga
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form action={createPayableAction} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <select
            name="category"
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all appearance-none"
            defaultValue="OUTRO"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PAYABLE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all sm:col-span-2"
            placeholder="Descrição"
            type="text"
            name="description"
            required
          />
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all"
            placeholder="Valor"
            type="number"
            step="0.01"
            name="amount"
            required
          />
          <select
            name="currency"
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all appearance-none"
            defaultValue="BRL"
          >
            {PAYABLE_CURRENCIES.filter((c) => c.value).map((c) => (
              <option key={c.value} value={c.value}>
                {c.value}
              </option>
            ))}
          </select>
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all"
            type="date"
            name="dueDate"
          />
          <button
            type="submit"
            className="sm:col-span-3 px-4 py-2 rounded-lg bg-secondary text-white text-xs font-bold hover:opacity-90 transition-all"
          >
            Adicionar conta
          </button>
        </form>
      )}
    </div>
  );
}
