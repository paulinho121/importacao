// Popula external_import_items a partir do controle paralelo que o
// usuário mantinha numa planilha própria (fora do sistema) com itens já
// em processo de importação — usado como referência pra avisar, ao
// montar um pedido de compra, quando o item escolhido já está vindo.
//
// db/external-import-items-data.json foi extraído uma vez da planilha
// original (múltiplos blocos de processo, cada um com status/fornecedor/
// ETA e uma lista de itens) — reimportar com um arquivo mais novo requer
// gerar esse JSON de novo a partir da planilha atualizada.
//
// Idempotente por natureza simples: sempre insere do zero (delete + insert)
// já que não há uma chave natural confiável pra fazer upsert linha a linha
// nesse tipo de dado externo. Rodar com: npx tsx db/seed-external-import-items.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "./client";
import { externalImportItems } from "./schema";

type RawItem = {
  status: string | null;
  fornecedor: string | null;
  processo: string | null;
  modal: string | null;
  invoice: string | null;
  etd: string | null;
  eta: string | null;
  agente: string | null;
  destino: string | null;
  sku: string | null;
  description: string;
  quantity: number | null;
  reserva: string | null;
};

const STATUS_MAP: Record<string, (typeof externalImportItems.$inferInsert)["status"]> = {
  "Concluido": "CONCLUIDO",
  "Em Desembaraço": "EM_DESEMBARACO",
  "Aguradando Embarque": "AGUARDANDO_EMBARQUE",
  "Em Negociação": "EM_NEGOCIACAO",
  "CANCELADO": "CANCELADO",
  "Consolidado em outro processo": "CONSOLIDADO_EM_OUTRO_PROCESSO",
};

async function main() {
  const dataPath = path.join(__dirname, "external-import-items-data.json");
  const rows: RawItem[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  await db.delete(externalImportItems);

  const values = rows.map((r) => {
    // "quantity" às vezes vem como texto (ex: "50ml", "1L" — tamanho de
    // embalagem de item consumível, não contagem de unidades) em vez de
    // número; guarda o valor original em notes pra não perder a
    // informação, já que a coluna numeric não aceita.
    const rawQty = r.quantity;
    const numericQty = rawQty !== null && Number.isFinite(Number(rawQty)) ? String(rawQty) : null;
    const notes = numericQty === null && rawQty !== null ? `Quantidade original: ${rawQty}` : null;

    return {
      sku: r.sku,
      description: r.description,
      quantity: numericQty,
      supplierName: r.fornecedor,
      processNumber: r.processo,
      status: r.status ? (STATUS_MAP[r.status] ?? null) : null,
      modal: r.modal,
      invoice: r.invoice,
      etd: r.etd,
      eta: r.eta,
      agent: r.agente,
      destination: r.destino,
      reservation: r.reserva,
      notes,
    };
  });

  const CHUNK = 50;
  for (let i = 0; i < values.length; i += CHUNK) {
    await db.insert(externalImportItems).values(values.slice(i, i + CHUNK));
  }

  console.log(`Inseridos ${values.length} itens em external_import_items.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
