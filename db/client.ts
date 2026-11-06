import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema, Pool>>;

let cached: Db | null = null;

// Driver `pg` (node-postgres), não o `postgres` (postgres.js): o postgres.js
// ENCADEIA várias consultas na mesma conexão quando há mais consultas do que
// conexões (e quando a conexão ainda está abrindo). O pooler de transações do
// Supabase (Supavisor, porta 6543) não aguenta isso: as consultas encadeadas
// ficavam presas para sempre ("active / ClientRead" no banco), esgotavam as vagas
// do pooler e o site inteiro travava no esqueleto da tela. Reproduzido: 1
// conexão com 6 consultas simultâneas terminava só 2; o `pg` termina 6 de 6, e
// 24 consultas em 5 conexões também (cada conexão executa uma consulta por vez e
// o excedente espera na fila do pool). Instruções preparadas continuam desligadas
// (o pooler de transações não as suporta): o `pg` só as usa com consultas nomeadas.
function getDb(): Db {
  if (cached) return cached;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definida. Copie .env.example para .env.local (localmente) ou defina em Project Settings > Environment Variables (Vercel).",
    );
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Poucas conexões por instância (o pooler do Supabase já multiplexa); as
    // ociosas/antigas são fechadas, e esperar vaga ou conectar tem limite de tempo.
    max: 5,
    idleTimeoutMillis: 20_000,
    maxLifetimeSeconds: 60 * 30,
    connectionTimeoutMillis: 10_000,
    // Consulta que não responde falha em 25 s em vez de deixar a tela esperando
    // para sempre (a mensagem de erro aparece e dá para tentar de novo).
    query_timeout: 25_000,
  });
  // Sem isso, um erro numa conexão ociosa derruba o processo (evento 'error' sem ouvinte).
  pool.on("error", (e) => console.error("Erro numa conexão ociosa do banco:", e.message));

  // Diagnóstico: com DB_QUERY_LOG=1 cada instrução enviada ao banco (inclusive
  // BEGIN/COMMIT) é registrada em globalThis.__dbQueries — usado pelos testes de
  // desempenho. Desligado por padrão, sem custo em produção.
  if (process.env.DB_QUERY_LOG) {
    pool.on("connect", (client) => {
      const original = client.query.bind(client) as (...args: unknown[]) => unknown;
      (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
        const first = args[0] as string | { text?: string } | undefined;
        const text = typeof first === "string" ? first : (first?.text ?? "");
        const g = globalThis as unknown as { __dbQueries?: string[] };
        (g.__dbQueries ??= []).push(text);
        return original(...args);
      };
    });
  }

  cached = drizzle(pool, { schema });
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
