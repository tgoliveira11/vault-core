import type { VaultAdminConfigOverrideRecord } from "@tgoliveira/vault-core";
import { getSql } from "@/lib/db";

type OverrideRow = {
  key: string;
  value: unknown;
};

export async function ensureVaultAdminConfigSchema(): Promise<void> {
  await getSql()`
    CREATE TABLE IF NOT EXISTS vault_admin_config_overrides (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function loadVaultAdminOverrides(): Promise<VaultAdminConfigOverrideRecord> {
  await ensureVaultAdminConfigSchema();
  const rows = await getSql()<OverrideRow[]>`
    SELECT key, value FROM vault_admin_config_overrides
  `;
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setVaultAdminOverride(key: string, value: unknown): Promise<void> {
  await ensureVaultAdminConfigSchema();
  const jsonValue = value as Parameters<ReturnType<typeof getSql>["json"]>[0];
  await getSql()`
    INSERT INTO vault_admin_config_overrides (key, value, updated_at)
    VALUES (${key}, ${getSql().json(jsonValue)}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `;
}

export async function deleteVaultAdminOverride(key: string): Promise<void> {
  await ensureVaultAdminConfigSchema();
  await getSql()`
    DELETE FROM vault_admin_config_overrides WHERE key = ${key}
  `;
}
