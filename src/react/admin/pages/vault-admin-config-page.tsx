"use client";

import { listVaultAdminConfigEntries } from "../../../admin/resolve-config.js";
import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  SourceBadge,
  formatConfigValue,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

export function VaultAdminConfigPage({
  config,
  paths,
  env = {},
  LinkComponent,
}: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);
  const entries = listVaultAdminConfigEntries(config, env);

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Vault configuration"
        description="Effective settings resolved from environment variables and crypto profile."
      />

      <div className="vc-admin-card">
        <div className="vc-admin-table-wrap">
          <table className="vc-admin-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Value</th>
                <th>Source</th>
                <th>Env var</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.key}>
                  <td>
                    <strong>{entry.label}</strong>
                    <div className="vc-admin-card-desc">{entry.description}</div>
                  </td>
                  <td>
                    <code>{formatConfigValue(entry.value)}</code>
                  </td>
                  <td>
                    <SourceBadge source={entry.source} />
                  </td>
                  <td>{entry.envVar ? <code>{entry.envVar}</code> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
