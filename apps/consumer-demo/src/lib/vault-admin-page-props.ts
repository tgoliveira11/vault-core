import type { VaultAdminPageProps } from "@tgoliveira/vault-core/react";
import {
  getVaultAdminConfigAsync,
  getVaultAdminEnv,
  getVaultAdminOverridesAsync,
} from "@/lib/env/vault-from-env";

export const VAULT_CONFIG_API_BASE = "/api/vault";

/** Server-safe props (no functions — Link is attached in client wrappers). */
export async function getVaultAdminPageProps(): Promise<
  Pick<VaultAdminPageProps, "config" | "env" | "adminOverrides" | "configApiBase">
> {
  const [config, adminOverrides] = await Promise.all([
    getVaultAdminConfigAsync(),
    getVaultAdminOverridesAsync(),
  ]);

  return {
    config,
    env: getVaultAdminEnv(),
    adminOverrides,
    configApiBase: VAULT_CONFIG_API_BASE,
  };
}
