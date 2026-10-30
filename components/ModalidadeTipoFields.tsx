"use client";

import { useState } from "react";
import {
  MODALIDADES,
  TIPOS_EMBARQUE,
  modalidadeFromModal,
  tipoEmbarqueLabel,
  type Modalidade,
} from "@/lib/modais";

// Modalidade primeiro; o tipo de embarque só lista as opções daquela
// modalidade (e é limpo quando a modalidade muda).
export default function ModalidadeTipoFields({
  defaultModal,
  defaultContainerType,
  selectClassName,
  labelClassName,
}: {
  defaultModal: string | null;
  defaultContainerType: string | null;
  selectClassName: string;
  labelClassName: string;
}) {
  const [modalidade, setModalidade] = useState<Modalidade | "">(modalidadeFromModal(defaultModal) ?? "");
  const initialTipo = tipoEmbarqueLabel(defaultModal, defaultContainerType);
  const [tipo, setTipo] = useState(
    TIPOS_EMBARQUE.some((t) => t.value === initialTipo && t.modalidade === modalidadeFromModal(defaultModal))
      ? initialTipo
      : "",
  );

  const tipos = TIPOS_EMBARQUE.filter((t) => t.modalidade === modalidade);

  return (
    <>
      <div>
        <label className={labelClassName}>Modalidade</label>
        <select
          className={selectClassName}
          name="modalidade"
          value={modalidade}
          onChange={(e) => {
            setModalidade(e.target.value as Modalidade | "");
            setTipo("");
          }}
        >
          <option value="">Selecione a modalidade</option>
          {MODALIDADES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClassName}>Tipo de embarque</label>
        <select
          className={selectClassName}
          name="containerType"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          disabled={!modalidade}
        >
          <option value="">{modalidade ? "Selecione o tipo" : "Escolha a modalidade primeiro"}</option>
          {tipos.map((t) => (
            <option key={t.value} value={t.value}>
              {t.value}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
