"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/Sparkline";

export interface KpiTrend {
  value: number;
  direction: "up" | "down" | "flat";
  positive?: boolean;
}

export function KpiCard({
  icon,
  label,
  value,
  trend,
  sparklineData,
  accent = "var(--chart-1)",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: KpiTrend;
  sparklineData?: number[];
  accent?: string;
}) {
  const trendGood = trend ? (trend.positive ?? trend.direction !== "down") : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-card border border-border bg-card p-3.5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-medium",
              trend.direction === "flat"
                ? "text-muted-foreground"
                : trendGood
                  ? "text-success"
                  : "text-destructive",
            )}
          >
            {trend.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
            {trend.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
            {trend.direction === "flat" ? (
              <>
                <Minus className="h-3 w-3" />
                Estável
              </>
            ) : (
              `${trend.value}%`
            )}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-xl font-bold tracking-tight text-on-surface">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground truncate">{label}</p>

      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={sparklineData} color={accent} height={24} />
        </div>
      )}
    </motion.div>
  );
}
