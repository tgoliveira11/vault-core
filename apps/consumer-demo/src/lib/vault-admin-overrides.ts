import type { VaultAdminConfigOverrideRecord } from "@tgoliveira/vault-core";
import {
  VAULT_ADMIN_CONFIG_OVERRIDES_TABLE,
  getVaultAdminConfigOverrideSchemaSql,
} from "@tgoliveira/vault-core";
import { getSql } from "@/lib/db";

type OverrideRow = {
  key: string;
  value: unknown;
};

export async function ensureVaultAdminConfigSchema(): Promise<void> {
  await getSql().unsafe(getVaultAdminConfigOverrideSchemaSql());
}

export async function loadVaultAdminOverrides(): Promise<VaultAdminConfigOverrideRecord> {
  await ensureVaultAdminConfigSchema();
  const rows = await getSql()<OverrideRow[]>`
    SELECT key, value FROM ${getSql()(VAULT_ADMIN_CONFIG_OVERRIDES_TABLE)}
  `;
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setVaultAdminOverride(key: string, value: unknown): Promise<void> {
  await ensureVaultAdminConfigSchema();
  const jsonValue = value as Parameters<ReturnType<typeof getSql>["json"]>[0];
  const table = getSql()(VAULT_ADMIN_CONFIG_OVERRIDES_TABLE);
  await getSql()`
    INSERT INTO ${table} (key, value, updated_at)
    VALUES (${key}, ${getSql().json(jsonValue)}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `;
}

export async function deleteVaultAdminOverride(key: string): Promise<void> {
  await ensureVaultAdminConfigSchema();
  const table = getSql()(VAULT_ADMIN_CONFIG_OVERRIDES_TABLE);
  await getSql()`
    DELETE FROM ${table} WHERE key = ${key}
  `;
}
