"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { NAV_GROUPS } from "@/constants/nav";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function isActive(pathname: string, href: string) {
  const [path] = href.split("?");
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <TooltipProvider delayDuration={200}>
      <motion.aside
        animate={{ width: collapsed ? 76 : 256 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border overflow-hidden"
      >
        <div className="flex items-center gap-3 h-16 px-4 border-b border-sidebar-border shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
            <Ship className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-white truncate">ImportFlow</span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV_GROUPS.map((group, idx) => (
            <div key={group.label ?? `group-${idx}`} className="space-y-1">
              {group.label && !collapsed && (
                <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );

                if (!collapsed) return link;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 shrink-0 space-y-2">
          <div className={cn("flex items-center gap-3 rounded-lg px-2 py-2", collapsed && "justify-center px-0")}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-white shrink-0">
              LM
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">Logistics Manager</p>
                <p className="truncate text-xs text-sidebar-muted-foreground">Global Ops</p>
              </div>
            )}
          </div>
          <button
            onClick={toggle}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-white transition-colors",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
