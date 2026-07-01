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
  "Use validateNoPlaintextLeak / assertNoVaultPlaintextFields on every vault-related server payload.",
  "Authenticate and RBAC-protect vault admin/config APIs; rate-limit unlock attempts in app code (not UI only).",
  "VaultProtectedGate overlay is UX only — check useVaultUnlocked() before decrypting in application logic.",
  "Deploy a strict Content-Security-Policy; XSS with an unlocked vault can exfiltrate the in-memory UVK.",
  "AAD crypto contexts (aadContextVault / aadContextEnvelope) are deploy-time constants — not runtime admin overrides.",
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
          Product: <strong>{config.productName}</strong>. See{" "}
          <code>docs/CONSUMER_SECURITY_REQUIREMENTS.md</code> in the package for the mandatory
          consuming-app checklist (auth, rate limits, CSP, plaintext guards).
        </p>
      </div>
    </AdminShell>
  );
}
