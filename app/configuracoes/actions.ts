"use server";

import { db } from "@/db/client";
import { profiles, companyBranches, purchaseOrders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type CreateUserState = { error: string } | null;

export async function createUser(_prevState: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "OPERADOR") as "ADMIN" | "OPERADOR";

  if (!email || !password) return { error: "Informe e-mail e senha." };
  if (password.length < 6) return { error: "A senha precisa ter pelo menos 6 caracteres." };

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { error: `Não deu pra criar o usuário no Supabase Auth: ${error.message}` };

  await db.insert(profiles).values({ id: data.user.id, email, name, role });

  revalidatePath("/configuracoes");
  return null;
}

export async function createCompanyBranch(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";
  if (!name || !cnpj || !address) throw new Error("Nome, CNPJ e endereço são obrigatórios.");

  if (isDefault) {
    await db.update(companyBranches).set({ isDefault: false });
  }

  await db.insert(companyBranches).values({ name, cnpj, address, isDefault });

  revalidatePath("/configuracoes");
  revalidatePath("/pedidos-compra/novo");
}

export async function deleteCompanyBranch(branchId: string) {
  await requireAdmin();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.branchId, branchId));
  if (count > 0) throw new Error("Essa filial já está usada em pedidos de compra — não pode ser excluída.");

  await db.delete(companyBranches).where(eq(companyBranches.id, branchId));
  revalidatePath("/configuracoes");
  revalidatePath("/pedidos-compra/novo");
}
