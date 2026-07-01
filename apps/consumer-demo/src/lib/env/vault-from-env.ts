import { VAULT_ADMIN_ENV_CATALOG } from "@tgoliveira/vault-core";
import { buildVaultAdminConfigFromEnv } from "@tgoliveira/vault-core";
import { PRF_SALT_PREFIX, VAULT_PROFILE } from "@/lib/vault-profile";
import { loadVaultAdminOverrides } from "@/lib/vault-admin-overrides";

function buildVaultAdminConfigInput(adminOverrides: Record<string, unknown> = {}) {
  return {
    env: process.env,
    profile: VAULT_PROFILE,
    prfSaltPrefix: PRF_SALT_PREFIX,
    productName: process.env.APP_NAME ?? "Vault Core Demo",
    adminOverrides,
  };
}

/** App-owned env mapper — vault-core never reads process.env directly. */
export function getVaultAdminConfig() {
  return buildVaultAdminConfigFromEnv(buildVaultAdminConfigInput());
}

/** Resolved config including DB admin overrides (server-only). */
export async function getVaultAdminConfigAsync() {
  try {
    const adminOverrides = await loadVaultAdminOverrides();
    return buildVaultAdminConfigFromEnv(buildVaultAdminConfigInput(adminOverrides));
  } catch {
    return getVaultAdminConfig();
  }
}

/** Env keys passed to admin config pages for source badges. */
export function getVaultAdminEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    APP_NAME: process.env.APP_NAME,
  };
  for (const entry of VAULT_ADMIN_ENV_CATALOG) {
    env[entry.envVar] = process.env[entry.envVar];
  }
  return env;
}

export async function getVaultAdminOverridesAsync() {
  try {
    return await loadVaultAdminOverrides();
  } catch {
    return {};
  }
}

export function getVaultAutoLockMinutes(): number {
  return getVaultAdminConfig().session.autoLockMinutes;
}

export async function getVaultAutoLockMinutesAsync(): Promise<number> {
  const config = await getVaultAdminConfigAsync();
  return config.session.autoLockMinutes;
}
