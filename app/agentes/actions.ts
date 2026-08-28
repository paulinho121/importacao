"use server";

import { db } from "@/db/client";
import { freightAgents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash } from "@/lib/flash";

function readAgentForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Nome do agente de carga é obrigatório.");
  }
  return {
    name,
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createAgent(formData: FormData) {
  const values = readAgentForm(formData);
  const [created] = await db.insert(freightAgents).values(values).returning({ id: freightAgents.id });
  revalidatePath("/agentes");
  redirect(withFlash(`/agentes/${created.id}`, "Agente de carga cadastrado."));
}

export async function updateAgent(id: string, formData: FormData) {
  const values = readAgentForm(formData);
  await db
    .update(freightAgents)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(freightAgents.id, id));
  revalidatePath("/agentes");
  revalidatePath(`/agentes/${id}`);
  redirect(withFlash("/agentes", "Alterações salvas."));
}
