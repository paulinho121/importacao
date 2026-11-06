import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
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
  // prepare: false é necessário quando a connection string aponta para o
  // pooler do Supabase (pgbouncer, modo transaction) — que não suporta
  // prepared statements. Funciona também com conexão direta.
  const client = postgres(process.env.DATABASE_URL, {
    prepare: false,
    // fetch_types: false evita a consulta a pg_type que o driver faz em TODA
    // conexão nova (1 ida ao banco a mais por conexão; o sistema não usa
    // colunas de array). Medido: -71 ms na primeira consulta de cada conexão.
    fetch_types: false,
    // Poucas conexões por instância (o pooler do Supabase já multiplexa), e
    // conexões ociosas/antigas são fechadas: em ambiente serverless uma
    // conexão "congelada" não pode ficar presa ao pooler.
    max: 5,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 10,
    // Diagnóstico: com DB_QUERY_LOG=1 cada instrução enviada ao banco (inclusive
    // BEGIN/COMMIT) é registrada em globalThis.__dbQueries — usado pelos testes
    // de desempenho. Desligado por padrão, sem custo em produção.
    ...(process.env.DB_QUERY_LOG
      ? {
          debug: (_connection: number, query: string) => {
            const g = globalThis as unknown as { __dbQueries?: string[] };
            (g.__dbQueries ??= []).push(query);
          },
        }
      : {}),
  });
  cached = drizzle(client, { schema });
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
