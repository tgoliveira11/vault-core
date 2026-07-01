import { VaultAdminSecurityClient } from "@/components/admin/vault-admin-pages";
import { getVaultAdminPageProps } from "@/lib/vault-admin-page-props";

export default async function VaultAdminSecurityRoute() {
  return <VaultAdminSecurityClient {...await getVaultAdminPageProps()} />;
}
