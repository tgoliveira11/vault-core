"use client";

import { VAULT_CRYPTO_POLICY } from "../../../crypto/policy.js";
import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

export function VaultAdminCryptoPolicyPage({ config, paths, LinkComponent }: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);
  const { encryption, kdf, legacyKdf } = VAULT_CRYPTO_POLICY;

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Crypto policy"
        description="Canonical encryption and KDF policy shipped by @tgoliveira/vault-core."
      />

      <div className="vc-admin-grid vc-admin-grid--2">
        <div className="vc-admin-card">
          <h2 className="vc-admin-card-title">Encryption</h2>
          <ul className="vc-admin-list">
            <li>
              Algorithm: <code>{encryption.alg}</code>
            </li>
            <li>
              Payload version: <code>{encryption.version}</code>
            </li>
          </ul>
        </div>

        <div className="vc-admin-card">
          <h2 className="vc-admin-card-title">Recommended KDF ({kdf.version})</h2>
          <ul className="vc-admin-list">
            <li>
              Algorithm: <code>{kdf.algorithm}</code>
            </li>
            <li>
              Memory: <code>{kdf.params.memory}</code> KiB
            </li>
            <li>
              Iterations: <code>{kdf.params.iterations}</code>
            </li>
            <li>
              Parallelism: <code>{kdf.params.parallelism}</code>
            </li>
            <li>
              Hash length: <code>{kdf.params.hashLength}</code> bytes
            </li>
          </ul>
        </div>

        <div className="vc-admin-card">
          <h2 className="vc-admin-card-title">Legacy KDF ({legacyKdf.version})</h2>
          <ul className="vc-admin-list">
            <li>
              Memory: <code>{legacyKdf.params.memory}</code> KiB
            </li>
            <li>
              Iterations: <code>{legacyKdf.params.iterations}</code>
            </li>
            <li>
              Still decrypts existing envelopes; auto-upgrades on unlock when recommended.
            </li>
          </ul>
        </div>

        <div className="vc-admin-card vc-admin-card--muted">
          <h2 className="vc-admin-card-title">Backward compatibility</h2>
          <p className="vc-admin-card-desc">
            Legacy envelopes remain readable. After a successful unlock, call{" "}
            <code>maybeUpgradePasswordEnvelopeAfterUnlock</code> or{" "}
            <code>maybeUpgradeRecoveryEnvelopeAfterUnlock</code> to re-wrap with{" "}
            <code>{kdf.version}</code>.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
