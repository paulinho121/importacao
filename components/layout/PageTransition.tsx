"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

// Anima só a ENTRADA do conteúdo (opacidade + leve subida), sem esperar
// nenhuma saída — troca de rota nunca fica bloqueada por animação (regras
// "não atrasar carregamento" / "navegação deve parecer instantânea").
// key = pathname; usePathname() não exige Suspense boundary (diferente de
// useSearchParams(), que quebrava a pré-renderização estática da página
// 404 padrão do Next ao ser usado aqui).
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
