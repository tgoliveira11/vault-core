import { VaultAdminProfileClient } from "@/components/admin/vault-admin-pages";
import { getVaultAdminPageProps } from "@/lib/vault-admin-page-props";

export default async function VaultAdminProfileRoute() {
  return <VaultAdminProfileClient {...await getVaultAdminPageProps()} />;
}
