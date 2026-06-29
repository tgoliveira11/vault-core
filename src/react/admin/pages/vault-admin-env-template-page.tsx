"use client";

import { VAULT_ADMIN_ENV_CATALOG, buildVaultEnvLocalTemplate } from "../../../admin/env-catalog.js";
import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

export function VaultAdminEnvTemplatePage({ config, paths, LinkComponent }: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);
  const template = buildVaultEnvLocalTemplate(config.productName);

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Environment template"
        description="Copy-ready .env.local block for all vault-related variables."
      />

      <div className="vc-admin-card" style={{ marginBottom: "1rem" }}>
        <pre className="vc-admin-pre">{template}</pre>
      </div>

      <div className="vc-admin-card">
        <h2 className="vc-admin-card-title">Variable catalog</h2>
        <div className="vc-admin-table-wrap">
          <table className="vc-admin-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Group</th>
                <th>Description</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {VAULT_ADMIN_ENV_CATALOG.map((entry) => (
                <tr key={entry.envVar}>
                  <td>
                    <code>{entry.envVar}</code>
                    {entry.required ? " *" : ""}
                    {entry.clientVisible ? " (client)" : ""}
                  </td>
                  <td>{entry.group}</td>
                  <td>{entry.description}</td>
                  <td>
                    <code>{entry.example}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
