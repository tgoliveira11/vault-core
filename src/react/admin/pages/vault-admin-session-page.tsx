"use client";

import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

export function VaultAdminSessionPage({ config, paths, LinkComponent }: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);
  const { autoLockMinutes } = config.session;

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Session & auto-lock"
        description="Client-side inactivity timeout before the vault locks again."
      />

      <div className="vc-admin-grid vc-admin-grid--2">
        <div className="vc-admin-card">
          <h2 className="vc-admin-card-title">Auto-lock</h2>
          <p className="vc-admin-card-desc">
            Resolved timeout: <strong>{autoLockMinutes} minutes</strong> (
            {autoLockMinutes * 60 * 1000} ms)
          </p>
        </div>

        <div className="vc-admin-card vc-admin-card--muted">
          <h2 className="vc-admin-card-title">Environment variables</h2>
          <ul className="vc-admin-list">
            <li>
              <code>NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES</code> — preferred for Next.js client bundles
            </li>
            <li>
              <code>VAULT_AUTO_LOCK_MINUTES</code> — server-side fallback
            </li>
          </ul>
          <p className="vc-admin-card-desc" style={{ marginTop: "0.75rem" }}>
            Wire the resolved value into your vault session provider and activity listeners.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
