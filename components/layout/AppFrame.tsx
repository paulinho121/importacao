"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import AppShell from "@/components/AppShell";

// Ponto único de montagem do AppShell (Sidebar/Header), no layout raiz —
// antes cada page.tsx chamava <AppShell> por conta própria, então
// Sidebar/Header desmontavam e remontavam do zero em toda navegação
// (sumiam e reapareciam, sidebar reanimava a largura, etc). Agora ficam
// vivos entre páginas; só o conteúdo de dentro de <main> troca.
// /login fica de fora — não tem sidebar/header.
export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/login");

  if (isAuthRoute) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
