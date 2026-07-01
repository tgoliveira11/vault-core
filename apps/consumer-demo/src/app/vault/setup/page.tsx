import { VaultSetupClient } from "@/components/vault/vault-setup-client";
import { getVaultAdminConfigAsync } from "@/lib/env/vault-from-env";

export default async function VaultSetupRoute() {
  const config = await getVaultAdminConfigAsync();

  return (
    <VaultSetupClient
      recoveryWordCount={config.defaultRecoveryWordCount}
      passwordPolicy={config.passwordPolicy}
    />
  );
}
