"use server";

import { db } from "@/db/client";
import { freightAgents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash, withFlashError } from "@/lib/flash";

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

// Edição direta na lista de agentes: muda só nome, contato, e-mail e telefone
// (as observações, que só aparecem na página do agente, ficam como estão).
export async function updateAgentInline(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(withFlashError("/agentes", "O nome do agente é obrigatório."));

  const [same] = await db.select({ id: freightAgents.id }).from(freightAgents).where(eq(freightAgents.name, name));
  if (same && same.id !== id) {
    redirect(withFlashError("/agentes", `Já existe um agente chamado "${name}".`));
  }

  await db
    .update(freightAgents)
    .set({
      name,
      contactName: String(formData.get("contactName") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(freightAgents.id, id));
  revalidatePath("/agentes");
  revalidatePath(`/agentes/${id}`);
  revalidatePath("/processos");
  redirect(withFlash("/agentes", "Agente atualizado."));
}
