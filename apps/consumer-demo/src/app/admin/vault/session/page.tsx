import { VaultAdminSessionClient } from "@/components/admin/vault-admin-pages";
import { getVaultAdminPageProps } from "@/lib/vault-admin-page-props";

export default async function VaultAdminSessionRoute() {
  return <VaultAdminSessionClient {...await getVaultAdminPageProps()} />;
}
