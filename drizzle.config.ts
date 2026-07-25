import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Sem eager-throw: "drizzle-kit generate" não precisa conectar no banco
// (só diffa contra schema.ts), então não deve exigir DATABASE_URL. Só
// "drizzle-kit push"/"studio" realmente precisam conectar — se faltar a
// URL nesses casos, o próprio drizzle-kit reporta o erro.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
