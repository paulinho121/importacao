import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

function getDb(): Db {
  if (cached) return cached;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definida. Copie .env.example para .env.local (localmente) ou defina em Project Settings > Environment Variables (Vercel).",
    );
  }
  const sql = neon(process.env.DATABASE_URL);
  cached = drizzle(sql, { schema });
  return cached;
}

// Proxy: só conecta no primeiro uso real (ex: db.select(...)), nunca no
// momento do import. Isso evita quebrar o "collecting page data" do Next
// build, que importa o módulo de toda rota sem executar nenhuma query.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb();
    return Reflect.get(instance as object, prop, receiver);
  },
});
