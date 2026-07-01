/**
 * Reference persistence for runtime vault admin config overrides.
 * Consuming apps own the database, migrations, and REST API — vault-core ships the schema contract only.
 */

/** Default table name for persisted admin overrides (PostgreSQL reference). */
export const VAULT_ADMIN_CONFIG_OVERRIDES_TABLE = "vault_admin_config_overrides";

export type VaultAdminConfigOverrideRow = {
  key: string;
  value: unknown;
  updated_at: string | Date;
};

export type VaultAdminConfigOverrideSchemaSqlOptions = {
  /** When true (default), emits `CREATE TABLE IF NOT EXISTS`. */
  ifNotExists?: boolean;
  /** Override table name (defaults to {@link VAULT_ADMIN_CONFIG_OVERRIDES_TABLE}). */
  tableName?: string;
};

/**
 * Returns PostgreSQL DDL for the vault admin config overrides table.
 * Copy into your migration tool or run via `sql.unsafe()` during bootstrap.
 *
 * Expected API contract when using editable {@link VaultAdminConfigPage}:
 * - `GET {configApiBase}/admin/config` → `{ entries: VaultAdminConfigEntry[] }`
 * - `POST {configApiBase}/admin/config` → `{ key, value }`
 * - `DELETE {configApiBase}/admin/config` → `{ key }`
 */
export function getVaultAdminConfigOverrideSchemaSql(
  options: VaultAdminConfigOverrideSchemaSqlOptions = {}
): string {
  const ifNotExists = options.ifNotExists !== false ? " IF NOT EXISTS" : "";
  const tableName = options.tableName ?? VAULT_ADMIN_CONFIG_OVERRIDES_TABLE;

  return `CREATE TABLE${ifNotExists} ${tableName} (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
}
