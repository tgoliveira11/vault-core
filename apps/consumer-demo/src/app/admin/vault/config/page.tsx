import { VaultAdminConfigClient } from "@/components/admin/vault-admin-pages";
import { getVaultAdminPageProps } from "@/lib/vault-admin-page-props";

export default async function VaultAdminConfigRoute() {
  return <VaultAdminConfigClient {...await getVaultAdminPageProps()} />;
}
