import { VaultEmergencyExitPage } from "@/components/vault/vault-emergency-exit-page";
import { getVaultAdminConfigAsync } from "@/lib/env/vault-from-env";
import { notFound } from "next/navigation";

export default async function VaultEmergencyExitRoute() {
  const config = await getVaultAdminConfigAsync();
  if (config.features.emergencyModeEnabled !== true) notFound();
  return <VaultEmergencyExitPage />;
}
