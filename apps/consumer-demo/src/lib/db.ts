import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env.local");
  }
  return url;
}

export function getSql() {
  if (!sql) {
    sql = postgres(getDatabaseUrl(), { max: 5, prepare: false });
  }
  return sql;
}

export async function checkDatabaseConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    await getSql()`select 1 as ok`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Database unreachable",
    };
  }
}
