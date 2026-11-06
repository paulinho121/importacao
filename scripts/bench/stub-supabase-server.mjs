// Cada chamada real faria 1 ida ao serviço de login (getUser) + 1 consulta ao banco.
async function current() {
  globalThis.__bench.authCalls++;
  return globalThis.__bench.user;
}
export const getCurrentUser = current;
export const requireAdmin = current;
export async function createSupabaseServerClient() {
  return { auth: { getUser: async () => ({ data: { user: null } }) } };
}
