"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PipelineStage {
  label: string;
  count: number;
  percentage: number;
  avgDays: number | null;
}

export function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Logístico</CardTitle>
        <p className="text-sm text-muted-foreground">Quantidade de processos por etapa</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-on-surface">{stage.label}</span>
              <span className="text-muted-foreground">
                {stage.count} · {stage.percentage}%
                {stage.avgDays !== null && ` · ~${stage.avgDays}d`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, (stage.count / max) * 100)}%` }}
                transition={{ duration: 0.4, delay: index * 0.04 }}
                className="h-full rounded-full bg-secondary"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
