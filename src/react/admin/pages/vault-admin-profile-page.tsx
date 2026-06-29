"use client";

import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

export function VaultAdminProfilePage({ config, paths, LinkComponent }: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);
  const { profile, prfSaltPrefix, defaultRecoveryWordCount } = config;

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Crypto profile"
        description="App-specific AAD contexts and passkey PRF settings. Changing these after production data exists breaks decryption."
      />

      <div className="vc-admin-card">
        <div className="vc-admin-table-wrap">
          <table className="vc-admin-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Crypto version</td>
                <td>
                  <code>{profile.cryptoVersion}</code>
                </td>
              </tr>
              <tr>
                <td>Vault AAD context</td>
                <td>
                  <code>{profile.aadContextVault}</code>
                </td>
              </tr>
              <tr>
                <td>Envelope AAD context</td>
                <td>
                  <code>{profile.aadContextEnvelope}</code>
                </td>
              </tr>
              <tr>
                <td>PRF salt prefix</td>
                <td>
                  <code>{prfSaltPrefix}</code>
                </td>
              </tr>
              <tr>
                <td>Default recovery word count</td>
                <td>
                  <code>{defaultRecoveryWordCount}</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="vc-admin-card vc-admin-card--muted" style={{ marginTop: "1rem" }}>
        <p className="vc-admin-card-desc">
          Map <code>VAULT_AAD_CONTEXT_VAULT</code>, <code>VAULT_AAD_CONTEXT_ENVELOPE</code>, and{" "}
          <code>VAULT_PRF_SALT_PREFIX</code> in your app&apos;s env mapper, then pass the resulting{" "}
          <code>VaultCryptoProfile</code> to <code>buildVaultAdminConfigFromEnv</code>.
        </p>
      </div>
    </AdminShell>
  );
}
