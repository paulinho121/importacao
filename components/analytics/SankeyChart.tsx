"use client";

import { useMemo } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyNode, type SankeyLink } from "d3-sankey";
import type { SankeyData } from "@/lib/analytics";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type NodeExtra = { name: string };
type Node = SankeyNode<NodeExtra, object>;
type Link = SankeyLink<NodeExtra, object>;

export function SankeyChart({ data, width = 760, height = 380 }: { data: SankeyData; width?: number; height?: number }) {
  const { nodes, links } = useMemo(() => {
    const layout = sankey<NodeExtra, object>()
      .nodeWidth(14)
      .nodePadding(18)
      .extent([
        [1, 8],
        [width - 1, height - 8],
      ]);

    return layout({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    });
  }, [data, width, height]) as { nodes: Node[]; links: Link[] };

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sem dados suficientes ainda.</p>;
  }

  const pathGen = sankeyLinkHorizontal<Node, Link>();

  return (
    <svg width={width} height={height} className="overflow-visible">
      <g>
        {links.map((link, i) => {
          const d = pathGen(link);
          if (!d) return null;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeOpacity={0.25}
              strokeWidth={Math.max(1, link.width ?? 1)}
            />
          );
        })}
      </g>
      <g>
        {nodes.map((node, i) => (
          <g key={i}>
            <rect
              x={node.x0}
              y={node.y0}
              width={(node.x1 ?? 0) - (node.x0 ?? 0)}
              height={(node.y1 ?? 0) - (node.y0 ?? 0)}
              fill={COLORS[i % COLORS.length]}
              rx={2}
            />
            <text
              x={(node.x0 ?? 0) < width / 2 ? (node.x1 ?? 0) + 6 : (node.x0 ?? 0) - 6}
              y={((node.y0 ?? 0) + (node.y1 ?? 0)) / 2}
              dy="0.35em"
              textAnchor={(node.x0 ?? 0) < width / 2 ? "start" : "end"}
              className="fill-on-surface text-[11px] font-medium"
            >
              {node.name}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
