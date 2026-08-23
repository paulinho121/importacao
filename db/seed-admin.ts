// Cria o primeiro usuário Admin do sistema (bootstrap — depois disso,
// novos usuários são criados pela tela de Configurações, que só um Admin
// acessa). Idempotente: se o e-mail já existir no Supabase Auth, só
// garante que o profile correspondente tem role=ADMIN.
//
// Rodar com: npx tsx db/seed-admin.ts email@empresa.com "senha temporária" ["Nome"]

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./client";
import { profiles } from "./schema";
import { eq } from "drizzle-orm";
import { supabaseAdmin } from "../lib/supabase-admin";

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: npx tsx db/seed-admin.ts email@empresa.com "senha" ["Nome"]');
    process.exit(1);
  }

  let userId: string;

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (!createError.message.toLowerCase().includes("already been registered")) {
      throw createError;
    }
    // Já existe no Auth — busca o id pra garantir o profile mesmo assim.
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    const existing = list.users.find((u) => u.email === email);
    if (!existing) throw new Error(`Usuário ${email} não encontrado após erro "already registered".`);
    userId = existing.id;
    console.log(`Usuário ${email} já existia no Supabase Auth (id ${userId}).`);
  } else {
    userId = created.user.id;
    console.log(`Usuário ${email} criado no Supabase Auth (id ${userId}).`);
  }

  const [existingProfile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (existingProfile) {
    await db.update(profiles).set({ role: "ADMIN", name: name ?? existingProfile.name, updatedAt: new Date() }).where(eq(profiles.id, userId));
    console.log("Profile já existia — atualizado para role=ADMIN.");
  } else {
    await db.insert(profiles).values({ id: userId, email, name: name ?? null, role: "ADMIN" });
    console.log("Profile criado com role=ADMIN.");
  }

  console.log(`Pronto — ${email} já pode logar em /login.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
