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
      borderWidth={1}
      borderRadius={12}
      className="h-full px-3 py-2 shadow-sm transition-shadow group-hover:shadow-md"
    >
      <div className="flex min-h-7 items-center gap-1.5 sm:min-h-0">
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded [&>svg]:h-3 [&>svg]:w-3"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
        >
          {icon}
        </div>
        <p className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground line-clamp-2 sm:line-clamp-1" title={label}>
          {label}
        </p>
        {href && (
          <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground opacity-0 sm:block transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight tracking-tight text-on-surface" title={value}>
            {value}
          </p>
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[10px] font-medium leading-none",
                trend.direction === "flat"
                  ? "text-muted-foreground"
                  : trendGood
                    ? "text-success"
                    : "text-destructive",
              )}
            >
              {trend.direction === "up" && <ArrowUpRight className="h-2.5 w-2.5" />}
              {trend.direction === "down" && <ArrowDownRight className="h-2.5 w-2.5" />}
              {trend.direction === "flat" ? (
                <>
                  <Minus className="h-2.5 w-2.5" />
                  Estável
                </>
              ) : (
                `${trend.value}%`
              )}
            </span>
          )}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="hidden w-14 shrink-0 sm:block 2xl:hidden">
            <Sparkline data={sparklineData} color={accent} height={22} />
          </div>
        )}
      </div>
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
