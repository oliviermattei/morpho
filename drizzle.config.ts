import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Plan decision 17: "dotenv/config" only reads .env, which doesn't exist in
// this project — only .env.local is populated (.env.example is the
// documented template). Without this fix, dbCredentials.url is undefined
// and db:migrate fails on a message unrelated to its actual cause.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Neon Auth owns the neon_auth schema. Drizzle manages public only, and must
  // never generate a migration that touches neon_auth.
  schemaFilter: ["public"],
});
