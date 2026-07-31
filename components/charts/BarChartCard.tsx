"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BarChartCard({
  title,
  description,
  data,
  dataKey = "value",
  categoryKey = "label",
  color = "var(--chart-1)",
  layout = "horizontal",
}: {
  title: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  categoryKey?: string;
  color?: string;
  layout?: "horizontal" | "vertical";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: Math.max(220, data.length * 44) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={layout}
              margin={{ top: 8, right: 24, bottom: 0, left: layout === "vertical" ? 8 : -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={layout !== "vertical"} vertical={layout === "vertical"} />
              {layout === "vertical" ? (
                <>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey={categoryKey}
                    width={120}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey={categoryKey} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                </>
              )}
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey={dataKey} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
