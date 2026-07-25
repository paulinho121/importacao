import json
import os
import re
import uuid

_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(_DIR, "seed-data.json")
OUT_PATH = os.path.join(_DIR, "seed.sql")


def sql_str(v):
    if v is None:
        return "NULL"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def sql_num(v):
    if v is None:
        return "NULL"
    return str(v)


def sql_enum(v):
    return "NULL" if v is None else f"'{v}'"


def normalize_supplier_name(raw: str):
    m = re.match(r"^(.*?)\s*(\(|\+|-)\s*(.+)$", raw)
    if not m:
        return raw.strip(), None
    canonical = m.group(1).strip()
    return canonical, raw.strip()


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    supplier_id_by_name = {}
    supplier_rows = []
    process_rows = []
    item_rows = []

    for p in data:
        if not p["fornecedorRaw"]:
            continue
        canonical, _ = normalize_supplier_name(p["fornecedorRaw"])
        if canonical not in supplier_id_by_name:
            sid = str(uuid.uuid4())
            supplier_id_by_name[canonical] = sid
            supplier_rows.append((sid, canonical))

    for p in data:
        if not p["fornecedorRaw"]:
            continue
        canonical, suffix = normalize_supplier_name(p["fornecedorRaw"])
        supplier_id = supplier_id_by_name[canonical]

        supplier_note = (
            f"Fornecedor (planilha): {suffix}" if suffix and suffix != canonical else None
        )
        notes_parts = [n for n in [supplier_note, p["notes"]] if n]
        notes = " | ".join(notes_parts) if notes_parts else None

        process_id = str(uuid.uuid4())
        process_rows.append(
            (
                process_id,
                p["processNumber"],
                p["processoRaw"].replace("\n", " ").strip() if p["processoRaw"] else None,
                supplier_id,
                p["modal"],
                p["invoiceRaw"],
                p["etd"],
                p["etaEstimated"],
                p["agent"],
                p["destination"],
                p["status"],
                p["currentStep"],
                p["weightKg"],
                p["volumeM3"],
                notes,
            )
        )

        for item in p["items"]:
            item_rows.append(
                (
                    str(uuid.uuid4()),
                    process_id,
                    item["sku"],
                    item["description"],
                    item["quantity"],
                    item["reservedTo"],
                )
            )

    lines = []
    lines.append("-- Seed gerado a partir de PLANILHA DE IMPORTACOES - FIRST.xlsx")
    lines.append(
        "-- Rode isso DEPOIS de db/reset-supabase.sql e do migration em drizzle/0000_*.sql"
    )
    lines.append("--")
    lines.append("-- ASSUNCOES (14 dos 16 processos nao tinham status explicito na planilha,")
    lines.append("-- so cor de celula sem legenda documentada):")
    lines.append("--  - Fornecedores deduplicados por prefixo comum (ex: \"APUTURE + DEARKOL\"")
    lines.append("--    -> \"APUTURE\"); a variacao original fica em notes.")
    lines.append("--  - Status inferido de ETD/ETA vs. \"hoje\" = 2026-07-25 (data desta migracao):")
    lines.append("--    ETA passada = ATRASADO; ETD ja passado = EM_TRANSITO; senao AGUARDANDO_EMBARQUE.")
    lines.append("--  - Texto solto que caiu em colunas erradas (ex: \"0,65m3\" na coluna STATUS)")
    lines.append("--    foi preservado em notes, nunca descartado nem mal-interpretado.")
    lines.append("--  REVISE o status de cada processo apos importar -- e uma estimativa, nao um fato.")
    lines.append("")

    lines.append("-- Fornecedores (nomes normalizados/deduplicados a partir da planilha)")
    lines.append(
        "INSERT INTO suppliers (id, name, country) VALUES"
    )
    supplier_values = [
        f"  ({sql_str(sid)}, {sql_str(name)}, 'China')" for sid, name in supplier_rows
    ]
    lines.append(",\n".join(supplier_values) + ";")
    lines.append("")

    lines.append("-- Processos de importação")
    lines.append(
        "INSERT INTO processes (id, process_number, external_reference, supplier_id, modal, "
        "invoice_number, etd, eta_estimated, agent, destination, status, current_step, "
        "weight_kg, volume_m3, notes) VALUES"
    )
    process_values = []
    for row in process_rows:
        (
            pid,
            process_number,
            external_reference,
            supplier_id,
            modal,
            invoice_number,
            etd,
            eta_estimated,
            agent,
            destination,
            status,
            current_step,
            weight_kg,
            volume_m3,
            notes,
        ) = row
        process_values.append(
            "  ("
            f"{sql_str(pid)}, {sql_str(process_number)}, {sql_str(external_reference)}, "
            f"{sql_str(supplier_id)}, {sql_enum(modal)}, {sql_str(invoice_number)}, "
            f"{sql_str(etd) if etd else 'NULL'}, {sql_str(eta_estimated) if eta_estimated else 'NULL'}, "
            f"{sql_str(agent)}, {sql_str(destination)}, {sql_enum(status)}, {sql_num(current_step)}, "
            f"{sql_num(weight_kg)}, {sql_num(volume_m3)}, {sql_str(notes)}"
            ")"
        )
    lines.append(",\n".join(process_values) + ";")
    lines.append("")

    lines.append("-- Itens de cada processo")
    lines.append(
        "INSERT INTO process_items (id, process_id, sku, description, quantity, reserved_to) VALUES"
    )
    item_values = []
    for iid, process_id, sku, description, quantity, reserved_to in item_rows:
        item_values.append(
            "  ("
            f"{sql_str(iid)}, {sql_str(process_id)}, {sql_str(sku)}, {sql_str(description)}, "
            f"{sql_num(quantity)}, {sql_str(reserved_to)}"
            ")"
        )
    lines.append(",\n".join(item_values) + ";")
    lines.append("")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"suppliers={len(supplier_rows)} processes={len(process_rows)} items={len(item_rows)}")
    print("written to", OUT_PATH)


if __name__ == "__main__":
    main()
