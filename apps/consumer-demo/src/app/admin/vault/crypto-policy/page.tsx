import { VaultAdminCryptoPolicyClient } from "@/components/admin/vault-admin-pages";
import { getVaultAdminPageProps } from "@/lib/vault-admin-page-props";

export default async function VaultAdminCryptoPolicyRoute() {
  return <VaultAdminCryptoPolicyClient {...await getVaultAdminPageProps()} />;
}
