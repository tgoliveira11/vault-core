import type { VaultAdminConfigGroup } from "./types.js";

export type VaultAdminEnvVarDefinition = {
  envVar: string;
  label: string;
  description: string;
  group: VaultAdminConfigGroup;
  example: string;
  required?: boolean;
  clientVisible?: boolean;
};

/** Canonical vault-related environment variables for consuming applications. */
export const VAULT_ADMIN_ENV_CATALOG: VaultAdminEnvVarDefinition[] = [
  {
    envVar: "VAULT_ADMIN_ENABLED",
    label: "Vault admin enabled",
    description: "Enables the vault admin UI routes in the consuming application.",
    group: "admin",
    example: "true",
    required: true,
  },
  {
    envVar: "VAULT_ADMIN_PATH",
    label: "Vault admin base path",
    description: "Base URL path for vault admin screens (App Router mount point).",
    group: "admin",
    example: "/admin/vault",
  },
  {
    envVar: "VAULT_AAD_CONTEXT_VAULT",
    label: "Vault payload AAD context",
    description: "Stable AAD context string for encrypted vault payloads. Must not change after production data exists.",
    group: "crypto_profile",
    example: "my-app:vault:v1",
    required: true,
  },
  {
    envVar: "VAULT_AAD_CONTEXT_ENVELOPE",
    label: "Vault envelope AAD context",
    description: "Stable AAD context string for password/recovery/passkey envelopes.",
    group: "crypto_profile",
    example: "my-app:vault-envelope:v1",
    required: true,
  },
  {
    envVar: "VAULT_PRF_SALT_PREFIX",
    label: "Passkey PRF salt prefix",
    description: "Prefix used when deriving the passkey PRF salt for vault unlock (app-specific).",
    group: "crypto_profile",
    example: "my-app-passkey-prf-v1:",
  },
  {
    envVar: "VAULT_DEFAULT_RECOVERY_WORD_COUNT",
    label: "Default recovery phrase length",
    description: "Default BIP39 recovery phrase word count for new vault setups.",
    group: "crypto_profile",
    example: "24",
  },
  {
    envVar: "NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES",
    label: "Auto-lock minutes (client)",
    description: "Client-visible inactivity auto-lock duration in minutes. Preferred for Next.js apps.",
    group: "session",
    example: "15",
    clientVisible: true,
  },
  {
    envVar: "VAULT_AUTO_LOCK_MINUTES",
    label: "Auto-lock minutes (server fallback)",
    description: "Fallback auto-lock duration when the public client variable is not set.",
    group: "session",
    example: "15",
  },
  {
    envVar: "VAULT_PASSWORD_ENFORCEMENT",
    label: "Vault password enforcement",
    description: "How strictly vault setup validates the vault password policy.",
    group: "password_policy",
    example: "enforce",
  },
  {
    envVar: "VAULT_PASSWORD_MIN_LENGTH",
    label: "Vault password minimum length",
    description: "Minimum length for the vault password during setup and rotation.",
    group: "password_policy",
    example: "12",
  },
  {
    envVar: "VAULT_PASSWORD_REQUIRE_UPPERCASE",
    label: "Require uppercase",
    description: "Require at least one uppercase letter in the vault password.",
    group: "password_policy",
    example: "true",
  },
  {
    envVar: "VAULT_PASSWORD_REQUIRE_LOWERCASE",
    label: "Require lowercase",
    description: "Require at least one lowercase letter in the vault password.",
    group: "password_policy",
    example: "true",
  },
  {
    envVar: "VAULT_PASSWORD_REQUIRE_NUMBER",
    label: "Require number",
    description: "Require at least one digit in the vault password.",
    group: "password_policy",
    example: "true",
  },
  {
    envVar: "VAULT_PASSWORD_REQUIRE_SYMBOL",
    label: "Require symbol",
    description: "Require at least one symbol in the vault password.",
    group: "password_policy",
    example: "true",
  },
  {
    envVar: "VAULT_PASSWORD_BLOCK_COMMON_PASSWORDS",
    label: "Block common passwords",
    description: "Reject commonly used passwords for the vault password.",
    group: "password_policy",
    example: "true",
  },
  {
    envVar: "VAULT_PASSWORD_MIN_SCORE",
    label: "Minimum strength score",
    description: "Minimum zxcvbn-style score (0–4) for the vault password when enforced.",
    group: "password_policy",
    example: "2",
  },
  {
    envVar: "VAULT_PASSWORD_STRENGTH_POSITION",
    label: "Strength meter position",
    description: "Where the vault password strength meter appears relative to the input.",
    group: "password_policy",
    example: "below",
  },
  {
    envVar: "VAULT_PASSKEY_PRF_UNLOCK_ENABLED",
    label: "Passkey PRF unlock",
    description: "Whether passkey PRF vault unlock is offered during setup and unlock.",
    group: "features",
    example: "true",
  },
];

export function buildVaultEnvLocalTemplate(productName = "My App"): string {
  const header = `# ${productName} — vault configuration (.env.local)
# Generated from @tgoliveira/vault-core admin catalog. Adjust before production.
`;
  const body = VAULT_ADMIN_ENV_CATALOG.map((entry) => {
    const required = entry.required ? " (required)" : "";
    return `# ${entry.label}${required}\n# ${entry.description}\n${entry.envVar}=${entry.example}`;
  }).join("\n\n");

  return `${header}\n${body}\n`;
}
