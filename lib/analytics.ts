import { db } from "@/db/client";
import { processes, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CUSTOMS_CHANNEL_LABEL, type CustomsChannel } from "@/lib/status";

export type SankeyData = {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
};

export async function getSankeyData(): Promise<SankeyData> {
  const rows = await db
    .select({
      supplierName: suppliers.name,
      modal: processes.modal,
      customsChannel: processes.customsChannel,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id));

  const nodeIndex = new Map<string, number>();
  const nodes: { name: string }[] = [];
  const linkValue = new Map<string, number>();

  function nodeId(name: string) {
    if (!nodeIndex.has(name)) {
      nodeIndex.set(name, nodes.length);
      nodes.push({ name });
    }
    return nodeIndex.get(name)!;
  }

  function addLink(source: string, target: string) {
    const key = `${source} ${target}`;
    linkValue.set(key, (linkValue.get(key) ?? 0) + 1);
  }

  for (const r of rows) {
    const modalLabel = r.modal ?? "Modal não definido";
    const channelLabel = r.customsChannel
      ? CUSTOMS_CHANNEL_LABEL[r.customsChannel as CustomsChannel]
      : "Sem canal ainda";
    addLink(r.supplierName, modalLabel);
    addLink(modalLabel, channelLabel);
  }

  const links = Array.from(linkValue.entries()).map(([key, value]) => {
    const [source, target] = key.split(" ");
    return { source: nodeId(source), target: nodeId(target), value };
  });

  return { nodes, links };
}
