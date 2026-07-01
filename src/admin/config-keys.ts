import type { VaultAdminConfigGroup } from "./types.js";

export type VaultConfigValueType = "boolean" | "string" | "number" | "enum";

export type VaultConfigKeyDefinition = {
  key: string;
  envVar?: string;
  label: string;
  description: string;
  group: VaultAdminConfigGroup;
  type: VaultConfigValueType;
  enumValues?: readonly string[];
  min?: number;
  max?: number;
  overridable: boolean;
};

/** Keys that can be overridden via admin (priority: admin → env → default). */
export const VAULT_OVERRIDABLE_CONFIG_KEYS = [
  "enabled",
  "basePath",
  "prfSaltPrefix",
  "defaultRecoveryWordCount",
  "autoLockMinutes",
  "passwordEnforcement",
  "passwordMinLength",
  "passwordRequireUppercase",
  "passwordRequireLowercase",
  "passwordRequireNumber",
  "passwordRequireSymbol",
  "passwordBlockCommonPasswords",
  "passwordMinScore",
  "passwordStrengthPosition",
  "passkeyPrfUnlockEnabled",
  "unlockMaxFailures",
  "unlockFailureWindowMinutes",
  "unlockLockoutMinutes",
  "apiMaxRequests",
  "apiWindowSeconds",
] as const;

export type VaultOverridableConfigKey = (typeof VAULT_OVERRIDABLE_CONFIG_KEYS)[number];

const OVERRIDABLE_SET = new Set<string>(VAULT_OVERRIDABLE_CONFIG_KEYS);

export function isVaultOverridableConfigKey(key: string): key is VaultOverridableConfigKey {
  return OVERRIDABLE_SET.has(key);
}

export const VAULT_CONFIG_KEY_DEFINITIONS: VaultConfigKeyDefinition[] = [
  {
    key: "enabled",
    envVar: "VAULT_ADMIN_ENABLED",
    label: "Vault admin enabled",
    description: "Whether vault admin routes are enabled in the consuming app.",
    group: "admin",
    type: "boolean",
    overridable: true,
  },
  {
    key: "basePath",
    envVar: "VAULT_ADMIN_PATH",
    label: "Admin base path",
    description: "Mount path for vault admin pages.",
    group: "admin",
    type: "string",
    overridable: true,
  },
  {
    key: "aadContextVault",
    envVar: "VAULT_AAD_CONTEXT_VAULT",
    label: "Vault AAD context",
    description:
      "Additional authenticated data context for vault payloads. Set via env at deploy time — not overridable at runtime.",
    group: "crypto_profile",
    type: "string",
    overridable: false,
  },
  {
    key: "aadContextEnvelope",
    envVar: "VAULT_AAD_CONTEXT_ENVELOPE",
    label: "Envelope AAD context",
    description:
      "Additional authenticated data context for key envelopes. Set via env at deploy time — not overridable at runtime.",
    group: "crypto_profile",
    type: "string",
    overridable: false,
  },
  {
    key: "prfSaltPrefix",
    envVar: "VAULT_PRF_SALT_PREFIX",
    label: "PRF salt prefix",
    description: "Passkey PRF salt prefix for vault unlock.",
    group: "crypto_profile",
    type: "string",
    overridable: true,
  },
  {
    key: "defaultRecoveryWordCount",
    envVar: "VAULT_DEFAULT_RECOVERY_WORD_COUNT",
    label: "Default recovery word count",
    description: "Default BIP39 phrase length for new vaults.",
    group: "crypto_profile",
    type: "enum",
    enumValues: ["12", "24"],
    overridable: true,
  },
  {
    key: "autoLockMinutes",
    envVar: "NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES",
    label: "Auto-lock minutes",
    description: "Inactivity duration before the vault locks.",
    group: "session",
    type: "number",
    min: 1,
    max: 24 * 60,
    overridable: true,
  },
  {
    key: "passwordEnforcement",
    envVar: "VAULT_PASSWORD_ENFORCEMENT",
    label: "Password enforcement",
    description: "Vault password policy enforcement mode.",
    group: "password_policy",
    type: "enum",
    enumValues: ["off", "warn", "enforce"],
    overridable: true,
  },
  {
    key: "passwordMinLength",
    envVar: "VAULT_PASSWORD_MIN_LENGTH",
    label: "Password min length",
    description: "Minimum vault password length.",
    group: "password_policy",
    type: "number",
    min: 1,
    max: 128,
    overridable: true,
  },
  {
    key: "passwordRequireUppercase",
    envVar: "VAULT_PASSWORD_REQUIRE_UPPERCASE",
    label: "Require uppercase",
    description: "Require at least one uppercase letter in the vault password.",
    group: "password_policy",
    type: "boolean",
    overridable: true,
  },
  {
    key: "passwordRequireLowercase",
    envVar: "VAULT_PASSWORD_REQUIRE_LOWERCASE",
    label: "Require lowercase",
    description: "Require at least one lowercase letter in the vault password.",
    group: "password_policy",
    type: "boolean",
    overridable: true,
  },
  {
    key: "passwordRequireNumber",
    envVar: "VAULT_PASSWORD_REQUIRE_NUMBER",
    label: "Require number",
    description: "Require at least one digit in the vault password.",
    group: "password_policy",
    type: "boolean",
    overridable: true,
  },
  {
    key: "passwordRequireSymbol",
    envVar: "VAULT_PASSWORD_REQUIRE_SYMBOL",
    label: "Require symbol",
    description: "Require at least one symbol in the vault password.",
    group: "password_policy",
    type: "boolean",
    overridable: true,
  },
  {
    key: "passwordBlockCommonPasswords",
    envVar: "VAULT_PASSWORD_BLOCK_COMMON_PASSWORDS",
    label: "Block common passwords",
    description: "Reject commonly used passwords for the vault password.",
    group: "password_policy",
    type: "boolean",
    overridable: true,
  },
  {
    key: "passwordMinScore",
    envVar: "VAULT_PASSWORD_MIN_SCORE",
    label: "Password min score",
    description: "Minimum vault password strength score.",
    group: "password_policy",
    type: "number",
    min: 0,
    max: 4,
    overridable: true,
  },
  {
    key: "passwordStrengthPosition",
    envVar: "VAULT_PASSWORD_STRENGTH_POSITION",
    label: "Strength meter position",
    description: "Where the vault password strength meter appears relative to the input.",
    group: "password_policy",
    type: "enum",
    enumValues: ["above", "below"],
    overridable: true,
  },
  {
    key: "passkeyPrfUnlockEnabled",
    envVar: "VAULT_PASSKEY_PRF_UNLOCK_ENABLED",
    label: "Passkey PRF unlock",
    description: "Whether passkey PRF unlock is enabled.",
    group: "features",
    type: "boolean",
    overridable: true,
  },
  {
    key: "unlockMaxFailures",
    envVar: "VAULT_UNLOCK_MAX_FAILURES",
    label: "Unlock max failures",
    description: "Failed unlock attempts allowed per scope before lockout.",
    group: "rate_limit",
    type: "number",
    min: 1,
    max: 100,
    overridable: true,
  },
  {
    key: "unlockFailureWindowMinutes",
    envVar: "VAULT_UNLOCK_FAILURE_WINDOW_MINUTES",
    label: "Unlock failure window (minutes)",
    description: "Rolling window for counting failed unlock attempts.",
    group: "rate_limit",
    type: "number",
    min: 1,
    max: 24 * 60,
    overridable: true,
  },
  {
    key: "unlockLockoutMinutes",
    envVar: "VAULT_UNLOCK_LOCKOUT_MINUTES",
    label: "Unlock lockout (minutes)",
    description: "Lockout duration after exceeding failed unlock attempts.",
    group: "rate_limit",
    type: "number",
    min: 1,
    max: 24 * 60,
    overridable: true,
  },
  {
    key: "apiMaxRequests",
    envVar: "VAULT_API_RATE_LIMIT_MAX_REQUESTS",
    label: "API max requests",
    description: "Maximum vault HTTP API requests per client key per window.",
    group: "rate_limit",
    type: "number",
    min: 1,
    max: 10_000,
    overridable: true,
  },
  {
    key: "apiWindowSeconds",
    envVar: "VAULT_API_RATE_LIMIT_WINDOW_SECONDS",
    label: "API rate limit window (seconds)",
    description: "Fixed window length for vault HTTP API rate limiting.",
    group: "rate_limit",
    type: "number",
    min: 1,
    max: 3600,
    overridable: true,
  },
  {
    key: "recommendedKdfVersion",
    label: "Recommended KDF version",
    description: "KDF version used for new envelopes and auto-upgrade targets.",
    group: "crypto_profile",
    type: "string",
    overridable: false,
  },
  {
    key: "encryptionAlgorithm",
    label: "Encryption algorithm",
    description: "Symmetric encryption algorithm for vault payloads.",
    group: "crypto_profile",
    type: "string",
    overridable: false,
  },
];

const DEFINITION_BY_KEY = new Map(
  VAULT_CONFIG_KEY_DEFINITIONS.map((definition) => [definition.key, definition])
);

export function getVaultConfigKeyDefinition(key: string): VaultConfigKeyDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function validateVaultAdminOverride(key: string, value: unknown): void {
  if (!isVaultOverridableConfigKey(key)) {
    throw new Error(`Key "${key}" is not overridable via admin panel`);
  }

  const definition = getVaultConfigKeyDefinition(key);
  if (!definition) {
    throw new Error(`Unknown config key "${key}"`);
  }

  switch (definition.type) {
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`Key "${key}" must be a boolean`);
      }
      return;
    case "string":
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`Key "${key}" must be a non-empty string`);
      }
      return;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`Key "${key}" must be an integer`);
      }
      if (definition.min != null && value < definition.min) {
        throw new Error(`Key "${key}" must be >= ${definition.min}`);
      }
      if (definition.max != null && value > definition.max) {
        throw new Error(`Key "${key}" must be <= ${definition.max}`);
      }
      return;
    case "enum": {
      const allowed = definition.enumValues ?? [];
      const normalized = String(value);
      if (!allowed.includes(normalized)) {
        throw new Error(`Key "${key}" must be one of: ${allowed.join(", ")}`);
      }
      return;
    }
  }
}
