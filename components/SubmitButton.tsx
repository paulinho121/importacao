"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

// Botão de envio de formulário que impede gravações duplicadas:
//  - enquanto a Server Action roda, fica desabilitado (useFormStatus);
//  - cliques repetidos em menos de meio segundo são ignorados na hora (o React só
//    marca o botão como "gravando" um instante depois do primeiro clique, e um
//    clique duplo rápido passaria por essa janela).
// Só reage quando o formulário tem uma ação em execução: num formulário sem ação,
// ou com a confirmação cancelada, o botão volta ao normal logo em seguida. O
// visual não muda: é o mesmo <button>, com as mesmas classes (só esmaece um pouco
// durante a gravação).
const DOUBLE_CLICK_MS = 500;

export default function SubmitButton({
  children,
  className = "",
  disabled,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const lastClick = useRef(0);
  return (
    <button
      {...rest}
      type={rest.type ?? "submit"}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={`${className}${pending ? " opacity-60 cursor-wait" : ""}`}
      onClick={(e) => {
        const now = Date.now();
        if (now - lastClick.current < DOUBLE_CLICK_MS) {
          e.preventDefault(); // clique repetido: não envia de novo
          return;
        }
        lastClick.current = now;
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
