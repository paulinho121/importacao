// Reconhece erros do Postgres vindos do driver (o Drizzle embrulha o erro
// original em `cause`). Usado para tratar a violação de chave única como
// "já existe" em vez de consultar antes de gravar: uma ida ao banco a menos e
// sem janela de corrida entre a consulta e a gravação.

type PgLike = { code?: string; constraint?: string; constraint_name?: string; cause?: unknown };

function pg(e: unknown): { code?: string; constraint?: string } {
  const err = e as PgLike | null;
  if (!err || typeof err !== "object") return {};
  const direct = { code: err.code, constraint: err.constraint ?? err.constraint_name };
  if (direct.code) return direct;
  const cause = err.cause as PgLike | undefined;
  return cause ? { code: cause.code, constraint: cause.constraint ?? cause.constraint_name } : {};
}

// 23505 = unique_violation. `constraint` (opcional) restringe a uma restrição.
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const { code, constraint: name } = pg(e);
  return code === "23505" && (!constraint || name === constraint);
}
