"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { LayoutDashboard, PackageSearch, Boxes, Building2, Users } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import PageTransition from "@/components/layout/PageTransition";
import FlashToast from "@/components/layout/FlashToast";
import { Toaster } from "@/components/ui/sonner";
import { CurrentUserProvider } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/processos", label: "Processos", icon: PackageSearch },
  { href: "/produtos", label: "Produtos", icon: Boxes },
  { href: "/fornecedores", label: "Fornecedores", icon: Building2 },
  { href: "/agentes", label: "Agentes", icon: Users },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <CurrentUserProvider>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
        <Toaster position="top-right" richColors />
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
        <div className="flex min-h-screen bg-background">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>

          <div className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={null}>
              <Header />
            </Suspense>
            <main className="flex-1 pb-20 md:pb-0">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>

          <nav
            data-app-chrome
            aria-label="Navegação principal"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/85 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden"
          >
            <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
              {MOBILE_NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
                      active ? "text-secondary" : "text-muted-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-0 h-0.5 w-8 rounded-full bg-secondary transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span
                      className={cn(
                        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                        active && "bg-secondary/15",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="max-w-full truncate px-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </MotionConfig>
    </CurrentUserProvider>
  );
}
