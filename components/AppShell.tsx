"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { LayoutDashboard, PackageSearch, Boxes, Building2, Users } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import PageTransition from "@/components/layout/PageTransition";
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

          <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-border bg-card shadow-sm md:hidden">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors active:scale-95",
                    active ? "text-secondary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </MotionConfig>
    </CurrentUserProvider>
  );
}
