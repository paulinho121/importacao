"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Bell, ChevronRight, Home, Moon, Search, Sun, LogOut, Settings } from "lucide-react";
import { NAV_GROUPS } from "@/constants/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentUser, initials } from "@/lib/use-current-user";
import { signOutAction } from "@/app/session-actions";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";

const LABEL_BY_PATH = new Map<string, string>(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.href.split("?")[0], item.label] as const)),
);

function useBreadcrumb(pathname: string) {
  if (pathname === "/") return [{ label: "Dashboard", href: "/" }];

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Dashboard", href: "/" }];
  let acc = "";
  for (const segment of segments) {
    acc += `/${segment}`;
    const label = LABEL_BY_PATH.get(acc) ?? segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: acc });
  }
  return crumbs;
}

export default function Header() {
  const pathname = usePathname();
  const crumbs = useBreadcrumb(pathname);
  const [dark, setDark] = React.useState(true);
  const user = useCurrentUser();

  React.useEffect(() => {
    // Escuro é o padrão (já vem assim do servidor); só troca pra claro se o
    // usuário tiver escolhido isso antes. Fica no efeito em vez de um script
    // bloqueante em <head>/<body> — evita 1 frame de flash pra quem não
    // mudou o tema, ao custo de um flash mínimo só pra quem escolheu claro.
    if (localStorage.getItem("theme") === "light") {
      document.documentElement.classList.remove("dark");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage (sistema externo), não estado derivado de props/render.
      setDark(false);
    }
  }, []);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4 lg:px-6">
      <MobileNavDrawer />
      <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <Home className="h-4 w-4 shrink-0" />
        {crumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.href}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            {idx === crumbs.length - 1 ? (
              <span className="truncate font-medium text-on-surface">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="truncate hover:text-on-surface transition-colors">
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar processos, fornecedores..."
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-on-surface placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-on-surface transition-colors"
          aria-label="Alternar tema"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-on-surface transition-colors"
              aria-label="Notificações"
            >
              <Bell className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nenhum alerta no momento.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-muted transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-on-secondary text-xs">
                  {user ? initials(user.name, user.email) : "…"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.name || user?.email || "Carregando..."}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOutAction()}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
