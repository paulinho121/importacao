"use client";

import * as React from "react";
import { getCurrentUserAction } from "@/app/session-actions";
import type { CurrentUser } from "@/lib/supabase-server";

// Header e Sidebar mostram o mesmo usuário — busca uma vez por
// montagem em vez de duplicar a chamada em cada componente.
export function useCurrentUser() {
  const [user, setUser] = React.useState<CurrentUser | null>(null);

  React.useEffect(() => {
    getCurrentUserAction().then(setUser);
  }, []);

  return user;
}

export function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
