"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyCpListResults, applyIncisoBase, applyLpcoSheet, getProductsForCpList } from "@/app/produtos/actions";
import { listDateFromFileName, scanUpload } from "@/lib/cp-list";

type LpcoReport = { inserted: number; updated: number; skipped: number; unmatched: string[]; ambiguous: string[] };
type IncisoReport = { updated: number; created: number; unmatched: string[]; ambiguous: string[] };

// Upload manual de planilha em dois formatos, reconhecidos pelo cabeçalho:
//  - a lista pública do governo (.ods) — confere quais produtos já constam;
//  - a planilha de controle de LPCOs da MCI (.xlsx) — importa os LPCOs por estado.
// A planilha é lida aqui no navegador (a do governo é pesada pra mandar
// inteira ao servidor); o servidor recebe só o resultado.
export default function CpListUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<LpcoReport | null>(null);
  const [incisoReport, setIncisoReport] = useState<IncisoReport | null>(null);
  const [createMissing, setCreateMissing] = useState(false);

  async function run() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setReport(null);
    setIncisoReport(null);
    try {
      setMessage("Lendo a planilha — pode levar alguns segundos…");
      const catalog = await getProductsForCpList();
      const scan = await scanUpload(file, catalog);
      setMessage("Gravando o resultado…");

      if (scan.kind === "decex") {
        const res = await applyCpListResults({
          source: file.name,
          listDate: listDateFromFileName(file.name),
          matches: scan.matches,
        });
        toast.success(
          `Varredura concluída: ${res.found} deferido(s), ${res.foundNational} com fabricante nacional, ${
            res.foundApprox
          } para conferir, ${catalog.length - res.found - res.foundNational - res.foundApprox} não constam.`,
        );
      } else if (scan.kind === "inciso") {
        const { matched, unmatched, ambiguous } = scan.import;
        const res = await applyIncisoBase({ matched, create: createMissing ? unmatched : [] });
        setIncisoReport({
          ...res,
          unmatched: createMissing ? [] : unmatched.map((r) => r.model),
          ambiguous,
        });
        toast.success(
          `Base do Inciso V: ${res.updated} produto(s) atualizado(s), ${res.created} cadastrado(s)${
            createMissing ? "" : `, ${unmatched.length} fora do catálogo`
          }.`,
        );
      } else {
        const { records, unmatched, ambiguous, skipped } = scan.import;
        const res = await applyLpcoSheet({ records });
        setReport({ ...res, skipped, unmatched, ambiguous });
        toast.success(
          `Planilha de LPCOs: ${res.inserted} novo(s), ${res.updated} atualizado(s), ${
            unmatched.length + ambiguous.length
          } produto(s) não encontrado(s) no catálogo.`,
        );
      }

      setMessage("");
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setMessage("");
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".ods,.xlsx,.xls"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          disabled={busy}
          className="flex-1 min-w-0 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-surface-container-high file:text-on-surface-variant"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !fileName}
          className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {busy ? "Verificando…" : "Verificar planilha"}
        </button>
        {message && <span className="text-xs text-on-surface-variant">{message}</span>}
      </div>
      <label className="flex items-center gap-2 text-xs text-on-surface-variant">
        <input
          type="checkbox"
          checked={createMissing}
          onChange={(e) => setCreateMissing(e.target.checked)}
          disabled={busy}
          className="rounded border-outline-variant"
        />
        Na base do Inciso V, cadastrar também os itens que ainda não estão no catálogo
      </label>

      {incisoReport && (
        <div className="rounded-lg border border-outline-variant p-3 text-body-sm font-body-sm space-y-2">
          <p className="font-medium text-primary">
            Base do Inciso V: {incisoReport.updated} produto(s) atualizado(s) e {incisoReport.created} cadastrado(s).
            Só campos vazios foram preenchidos — nada do que já estava cadastrado foi sobrescrito.
          </p>
          {incisoReport.unmatched.length + incisoReport.ambiguous.length > 0 && (
            <details>
              <summary className="cursor-pointer text-secondary hover:underline">
                {incisoReport.unmatched.length + incisoReport.ambiguous.length} item(ns) da base não estão no catálogo
                (marque a opção acima e envie de novo para cadastrá-los)
              </summary>
              <ul className="mt-2 max-h-48 overflow-y-auto columns-2 gap-4 text-xs text-on-surface-variant">
                {incisoReport.unmatched.map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {incisoReport.ambiguous.map((n) => (
                  <li key={n}>{n} (nome repetido no catálogo)</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {report && (
        <div className="rounded-lg border border-outline-variant p-3 text-body-sm font-body-sm space-y-2">
          <p className="font-medium text-primary">
            LPCOs importados: {report.inserted} novo(s) e {report.updated} atualizado(s).
            {report.skipped > 0 && ` ${report.skipped} linha(s) ignorada(s) por falta de UF (SP, SC ou CE).`}
          </p>
          {report.unmatched.length + report.ambiguous.length > 0 && (
            <details>
              <summary className="cursor-pointer text-secondary hover:underline">
                {report.unmatched.length + report.ambiguous.length} produto(s) da planilha não foram encontrados no
                catálogo — cadastre-os (ou ajuste o nome/SKU) e envie de novo
              </summary>
              <ul className="mt-2 max-h-48 overflow-y-auto columns-2 gap-4 text-xs text-on-surface-variant">
                {report.unmatched.map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {report.ambiguous.map((n) => (
                  <li key={n}>{n} (nome repetido no catálogo)</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
