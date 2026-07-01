import postgres from "postgres";
import { getVaultAdminConfigOverrideSchemaSql } from "@tgoliveira/vault-core";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set — copy .env.example to .env.local");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.unsafe(getVaultAdminConfigOverrideSchemaSql());
  console.log("Applied vault admin config migration.");
} finally {
  await sql.end();
}
