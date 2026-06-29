import type { VaultAdminPaths, VaultAdminSection } from "./types.js";

export const DEFAULT_VAULT_ADMIN_PATHS: VaultAdminPaths = {
  panel: "/admin/vault",
  config: "/admin/vault/config",
  cryptoPolicy: "/admin/vault/crypto-policy",
  profile: "/admin/vault/profile",
  session: "/admin/vault/session",
  passwordPolicy: "/admin/vault/password-policy",
  security: "/admin/vault/security",
  envTemplate: "/admin/vault/env-template",
};

/** Admin navigation sections shown on the vault admin panel hub. */
export const VAULT_ADMIN_SECTIONS: VaultAdminSection[] = [
  {
    key: "config",
    label: "Configuration",
    description: "Effective vault settings resolved from environment and profile.",
  },
  {
    key: "envTemplate",
    label: "Environment template",
    description: "Copy-ready .env.local block for all vault-related variables.",
  },
  {
    key: "cryptoPolicy",
    label: "Crypto policy",
    description: "KDF versions, Argon2id parameters, and encryption algorithm.",
  },
  {
    key: "profile",
    label: "Crypto profile",
    description: "AAD contexts, PRF salt prefix, and recovery defaults.",
  },
  {
    key: "session",
    label: "Session & auto-lock",
    description: "Inactivity timeout and client session behavior.",
  },
  {
    key: "passwordPolicy",
    label: "Vault password policy",
    description: "Rules for vault setup and password rotation.",
  },
  {
    key: "security",
    label: "Security boundaries",
    description: "Account auth vs vault separation and zero-knowledge guarantees.",
  },
];

export function resolveVaultAdminPaths(basePath = "/admin/vault"): VaultAdminPaths {
  const normalized = basePath.replace(/\/+$/, "") || "/admin/vault";
  return {
    panel: normalized,
    config: `${normalized}/config`,
    cryptoPolicy: `${normalized}/crypto-policy`,
    profile: `${normalized}/profile`,
    session: `${normalized}/session`,
    passwordPolicy: `${normalized}/password-policy`,
    security: `${normalized}/security`,
    envTemplate: `${normalized}/env-template`,
  };
}

export type VaultAdminScreen = VaultAdminSection & { pathKey: keyof VaultAdminPaths };

export function listVaultAdminScreens(): VaultAdminScreen[] {
  return [
    {
      key: "config",
      pathKey: "panel",
      label: "Vault admin panel",
      description: "Hub with links to all vault admin screens.",
    },
    ...VAULT_ADMIN_SECTIONS.map((section) => ({ ...section, pathKey: section.key })),
  ];
}
