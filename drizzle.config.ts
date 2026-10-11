import { defineConfig } from "drizzle-kit";

// PostgreSQL schema for the API server. `npm run db:generate` writes SQL migrations to ./drizzle;
// the API applies them with `node server-dist/index.mjs migrate` (see docs/DEPLOY.md).
export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://nexus:nexus@127.0.0.1:5432/nexus_local" },
});
