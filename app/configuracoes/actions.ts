"use server";

import { db } from "@/db/client";
import { profiles } from "@/db/schema";
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
