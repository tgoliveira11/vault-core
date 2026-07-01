import { VaultAdminEnvTemplateClient } from "@/components/admin/vault-admin-pages";
import { getVaultAdminPageProps } from "@/lib/vault-admin-page-props";

export default async function VaultAdminEnvTemplateRoute() {
  return <VaultAdminEnvTemplateClient {...await getVaultAdminPageProps()} />;
}
