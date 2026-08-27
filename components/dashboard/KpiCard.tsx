"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/Sparkline";
import { BorderRotate } from "@/components/ui/animated-gradient-border";

export interface KpiTrend {
  value: number;
  direction: "up" | "down" | "flat";
  positive?: boolean;
}

// Quando tem href, o card inteiro é clicável (linka pra tela onde o dado
// que ele resume pode ser visto/filtrado) — Link já dá cursor de mão
// nativamente, então só acrescenta a affordance visual de hover.
const MotionLink = motion(Link);

export function KpiCard({
  icon,
  label,
  value,
  trend,
  sparklineData,
  accent = "var(--chart-1)",
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: KpiTrend;
  sparklineData?: number[];
  accent?: string;
  href?: string;
}) {
  const trendGood = trend ? (trend.positive ?? trend.direction !== "down") : null;

  // BorderRotate cuida da borda/fundo/raio do card (gradiente giratório em
  // teal, gira só no hover) — o wrapper de fora só cuida de entrada
  // animada, link e da sombra que muda no hover.
  const wrapperClassName = "group relative block h-full";

  const content = (
    <BorderRotate
      animationMode="rotate-on-hover"
      borderWidth={1.5}
      borderRadius={16}
      className="h-full p-3.5 shadow-sm transition-shadow group-hover:shadow-md"
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

      <p className="mt-2.5 text-xl font-bold tracking-tight text-on-surface truncate" title={value}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground truncate">{label}</p>

      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={sparklineData} color={accent} height={24} />
        </div>
      )}

      {href && (
        <ChevronRight className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </BorderRotate>
  );

  const motionProps = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 },
  };

  if (href) {
    return (
      <MotionLink href={href} className={wrapperClassName} {...motionProps}>
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.div className={wrapperClassName} {...motionProps}>
      {content}
    </motion.div>
  );
}
