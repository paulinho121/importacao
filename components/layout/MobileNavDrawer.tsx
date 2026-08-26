"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, Ship } from "lucide-react";
import { NAV_GROUPS } from "@/constants/nav";
import { cn } from "@/lib/utils";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function isActive(pathname: string, currentStatus: string, href: string) {
  const [path, query] = href.split("?");
  const matchesPath = path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
  if (!matchesPath) return false;
  const targetStatus = query ? (new URLSearchParams(query).get("status") ?? "") : "";
  return targetStatus === currentStatus;
}

export default function MobileNavDrawer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-on-surface transition-colors md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-3/4 sm:max-w-xs bg-sidebar-background text-sidebar-foreground border-sidebar-border p-0 flex flex-col"
      >
        <div className="flex items-center gap-3 h-16 px-4 border-b border-sidebar-border shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
            <Ship className="h-5 w-5" />
          </div>
          <span className="font-semibold text-white truncate">ImportFlow</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV_GROUPS.map((group, idx) => (
            <div key={group.label ?? `group-${idx}`} className="space-y-1">
              {group.label && (
                <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(pathname, currentStatus, item.href);
                const Icon = item.icon;
                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  </SheetClose>
                );
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
