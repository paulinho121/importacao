"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export type SignInState = { error: string } | null;

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha incorretos." };

  redirect("/");
}
