"use client";

import {
  AdminBackLink,
  AdminHeader,
  AdminShell,
  formatConfigValue,
  useVaultAdminPaths,
  type VaultAdminPageProps,
} from "../shared.js";

export function VaultAdminPasswordPolicyPage({
  config,
  paths,
  LinkComponent,
}: VaultAdminPageProps) {
  const resolvedPaths = useVaultAdminPaths(config, paths);
  const policy = config.passwordPolicy;

  const rows: Array<{ label: string; envVar: string; value: string | number | boolean }> = [
    { label: "Enforcement", envVar: "VAULT_PASSWORD_ENFORCEMENT", value: policy.enforcement },
    { label: "Minimum length", envVar: "VAULT_PASSWORD_MIN_LENGTH", value: policy.minLength },
    {
      label: "Require uppercase",
      envVar: "VAULT_PASSWORD_REQUIRE_UPPERCASE",
      value: policy.requireUppercase,
    },
    {
      label: "Require lowercase",
      envVar: "VAULT_PASSWORD_REQUIRE_LOWERCASE",
      value: policy.requireLowercase,
    },
    {
      label: "Require number",
      envVar: "VAULT_PASSWORD_REQUIRE_NUMBER",
      value: policy.requireNumber,
    },
    {
      label: "Require symbol",
      envVar: "VAULT_PASSWORD_REQUIRE_SYMBOL",
      value: policy.requireSymbol,
    },
    {
      label: "Block common passwords",
      envVar: "VAULT_PASSWORD_BLOCK_COMMON_PASSWORDS",
      value: policy.blockCommonPasswords,
    },
    { label: "Minimum score", envVar: "VAULT_PASSWORD_MIN_SCORE", value: policy.minScore },
    {
      label: "Strength meter position",
      envVar: "VAULT_PASSWORD_STRENGTH_POSITION",
      value: policy.strengthPosition,
    },
  ];

  return (
    <AdminShell>
      <AdminBackLink href={resolvedPaths.panel} LinkComponent={LinkComponent} />
      <AdminHeader
        title="Vault password policy"
        description="Separate from account auth password policy. Used during vault setup and password rotation."
      />

      <div className="vc-admin-card">
        <div className="vc-admin-table-wrap">
          <table className="vc-admin-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Value</th>
                <th>Env var</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.envVar}>
                  <td>{row.label}</td>
                  <td>
                    <code>{formatConfigValue(row.value)}</code>
                  </td>
                  <td>
                    <code>{row.envVar}</code>
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
