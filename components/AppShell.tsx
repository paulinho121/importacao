"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/processos", label: "Processos", icon: "receipt_long" },
  { href: "/produtos", label: "Produtos", icon: "inventory_2" },
  { href: "/fornecedores", label: "Fornecedores", icon: "factory" },
  { href: "/agentes", label: "Agentes de Carga", icon: "local_shipping" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex flex-col gap-unit py-stack-lg px-gutter h-screen sticky top-0 bg-surface border-r border-outline-variant w-[240px]">
        <div className="mb-stack-lg">
          <h1 className="font-headline-md text-headline-md text-primary font-bold">
            ImportFlow
          </h1>
        </div>
        <div className="flex items-center gap-3 mb-stack-lg p-3 bg-surface-container-low rounded-lg">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <div className="font-body-md text-body-md font-bold text-primary">
              Logistics Manager
            </div>
            <div className="text-[10px] text-outline uppercase tracking-wider">
              Global Ops
            </div>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 transition-all select-none font-body-md text-body-md rounded-lg ${
                  active
                    ? "text-on-secondary-fixed-variant bg-secondary-fixed font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center px-gutter h-16 w-full sticky top-0 z-40 bg-surface border-b border-outline-variant">
          <div className="flex items-center gap-4">
            <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-surface-container-high text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="hidden sm:block w-px h-6 bg-outline-variant" />
            <button className="hidden sm:flex items-center gap-2 text-primary font-bold">
              <span className="font-label-md text-label-md">GLOBAL OPS</span>
            </button>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-20 px-2 pb-safe md:hidden bg-surface border-t border-outline-variant shadow-sm z-50">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center px-4 py-1 active:scale-95 transition-transform ${
                active
                  ? "bg-secondary-container text-on-secondary-container rounded-full"
                  : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
