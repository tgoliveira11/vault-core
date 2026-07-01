import { VaultAdminPasswordPolicyClient } from "@/components/admin/vault-admin-pages";
import { getVaultAdminPageProps } from "@/lib/vault-admin-page-props";

export default async function VaultAdminPasswordPolicyRoute() {
  return <VaultAdminPasswordPolicyClient {...await getVaultAdminPageProps()} />;
}
