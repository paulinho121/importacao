"use client";

import * as React from "react";
import { getCurrentUserAction } from "@/app/session-actions";
import type { CurrentUser } from "@/lib/supabase-server";

const CurrentUserContext = React.createContext<CurrentUser | null>(null);

// Header e Sidebar mostram o mesmo usuário. Antes cada um chamava
// getCurrentUserAction() no seu próprio useEffect — 2 requisições
// idênticas ao servidor em toda carga de página, dobrando a latência de
// rede à toa. Agora busca uma vez aqui (num Provider montado 1x em
// AppShell) e os dois só leem do Context.
export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CurrentUser | null>(null);

  React.useEffect(() => {
    getCurrentUserAction().then(setUser);
  }, []);

  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return React.useContext(CurrentUserContext);
}

export function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
