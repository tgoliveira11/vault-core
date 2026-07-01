import postgres from "postgres";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../sql/001_vault_admin_config_overrides.sql");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set — copy .env.example to .env.local");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const migration = readFileSync(sqlPath, "utf8");

try {
  await sql.unsafe(migration);
  console.log("Applied vault admin config migration.");
} finally {
  await sql.end();
}
