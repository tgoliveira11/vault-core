"use client";

import { VAULT_ADMIN_SECTIONS } from "../../../admin/paths.js";
import {
  AdminHeader,
  AdminLink,
  AdminShell,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

export function VaultAdminPanelPage({ config, paths, LinkComponent }: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);

  return (
    <AdminShell>
      <AdminHeader
        title="Vault Admin"
        description={`Configure zero-knowledge vault settings for ${config.productName}.`}
      />

      {!config.enabled ? (
        <div className="vc-admin-card vc-admin-card--muted">
          <p className="vc-admin-card-desc">
            Vault admin is disabled. Set <code>VAULT_ADMIN_ENABLED=true</code> in your app
            environment to enable these routes in production.
          </p>
        </div>
      ) : null}

      <div className="vc-admin-grid vc-admin-grid--2 vc-admin-grid--3">
        {VAULT_ADMIN_SECTIONS.map((section) => (
          <AdminLink
            key={section.key}
            href={resolvedPaths[section.key]}
            className="vc-admin-card vc-admin-card--link"
            LinkComponent={LinkComponent}
          >
            <h2 className="vc-admin-card-title">{section.label}</h2>
            <p className="vc-admin-card-desc">{section.description}</p>
          </AdminLink>
        ))}
      </div>
    </AdminShell>
  );
}
