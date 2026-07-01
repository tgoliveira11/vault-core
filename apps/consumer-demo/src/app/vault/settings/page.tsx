import { VaultSettingsPage } from "@/components/vault/vault-settings-page";
import { getVaultAdminConfigAsync } from "@/lib/env/vault-from-env";

export default async function VaultSettingsRoute() {
  const config = await getVaultAdminConfigAsync();

  return (
    <VaultSettingsPage
      recoveryWordCount={config.defaultRecoveryWordCount}
      passkeyPrfUnlockEnabled={config.features.passkeyPrfUnlockEnabled}
      passwordPolicy={config.passwordPolicy}
      adminAutoLockMinutes={config.session.autoLockMinutes}
    />
  );
}
