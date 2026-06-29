"use client";

import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

const SECURITY_BOUNDARIES = [
  "Vault passwords and recovery phrases never leave the client in plaintext.",
  "Account auth passwords and vault passwords are independent policies and secrets.",
  "Server stores only encrypted envelopes and ciphertext — not vault keys or payloads.",
  "Passkey PRF output is used locally for unlock; it is not sent to your API as a secret.",
  "Admin pages display configuration only; they do not decrypt user vaults.",
  "Use validateNoPlaintextLeak / assertNoVaultPlaintextFields on server payloads.",
];

export function VaultAdminSecurityPage({ config, paths, LinkComponent }: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Security boundaries"
        description="Zero-knowledge guarantees and separation from account authentication."
      />

      <div className="vc-admin-card">
        <ul className="vc-admin-list">
          {SECURITY_BOUNDARIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="vc-admin-card vc-admin-card--muted" style={{ marginTop: "1rem" }}>
        <p className="vc-admin-card-desc">
          Product: <strong>{config.productName}</strong>. Protect admin routes with your app&apos;s
          existing admin authorization — vault-core does not implement account roles.
        </p>
      </div>
    </AdminShell>
  );
}
