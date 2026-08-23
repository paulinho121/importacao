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
      className="rounded-card border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              trend.direction === "flat"
                ? "text-muted-foreground"
                : trendGood
                  ? "text-success"
                  : "text-destructive",
            )}
          >
            {trend.direction === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
            {trend.direction === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
            {trend.direction === "flat" ? (
              <>
                <Minus className="h-3.5 w-3.5" />
                Estável
              </>
            ) : (
              `${trend.value}%`
            )}
          </span>
        )}
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight text-on-surface">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>

      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparklineData} color={accent} />
        </div>
      )}
    </motion.div>
  );
}
