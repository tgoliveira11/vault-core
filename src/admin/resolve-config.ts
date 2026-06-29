import { VAULT_CRYPTO_POLICY } from "../crypto/policy.js";
import type { VaultCryptoProfile } from "../profile.js";
import { readBoolEnv, readEnumEnv, readIntEnv, readStringEnv } from "./env-parse.js";
import type {
  VaultAdminConfig,
  VaultAdminConfigEntry,
  VaultAdminConfigInput,
} from "./types.js";

const DEFAULT_CRYPTO_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "app:vault:v1",
  aadContextEnvelope: "app:vault-envelope:v1",
};

const DEFAULT_AUTO_LOCK_MINUTES = 15;
const MIN_AUTO_LOCK_MINUTES = 1;
const MAX_AUTO_LOCK_MINUTES = 24 * 60;

function readAutoLockMinutes(env: Record<string, string | undefined>): number {
  const raw =
    env.NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES ?? env.VAULT_AUTO_LOCK_MINUTES;
  if (raw == null || raw.trim() === "") return DEFAULT_AUTO_LOCK_MINUTES;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
    throw new Error("VAULT auto-lock minutes must be an integer");
  }
  if (minutes < MIN_AUTO_LOCK_MINUTES || minutes > MAX_AUTO_LOCK_MINUTES) {
    throw new Error(
      `VAULT auto-lock minutes must be between ${MIN_AUTO_LOCK_MINUTES} and ${MAX_AUTO_LOCK_MINUTES}`
    );
  }
  return minutes;
}

function readRecoveryWordCount(
  env: Record<string, string | undefined>,
  fallback: 12 | 24
): 12 | 24 {
  const raw = env.VAULT_DEFAULT_RECOVERY_WORD_COUNT;
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (value === 12 || value === 24) return value;
  throw new Error("VAULT_DEFAULT_RECOVERY_WORD_COUNT must be 12 or 24");
}

function hasEnvValue(env: Record<string, string | undefined>, key: string): boolean {
  const raw = env[key];
  return raw != null && raw.trim() !== "";
}

/**
 * Builds the resolved vault admin configuration from app-owned environment values.
 * The consuming app reads process.env and passes a plain record — this package never reads process.env.
 */
export function buildVaultAdminConfigFromEnv(
  input: VaultAdminConfigInput = {}
): VaultAdminConfig {
  const env = input.env ?? {};
  const profile =
    input.profile ??
    ({
      cryptoVersion: "vault-v1",
      aadContextVault: readStringEnv(
        env,
        "VAULT_AAD_CONTEXT_VAULT",
        DEFAULT_CRYPTO_PROFILE.aadContextVault
      ),
      aadContextEnvelope: readStringEnv(
        env,
        "VAULT_AAD_CONTEXT_ENVELOPE",
        DEFAULT_CRYPTO_PROFILE.aadContextEnvelope
      ),
    } satisfies VaultCryptoProfile);
  const prfSaltPrefix =
    input.prfSaltPrefix ??
    readStringEnv(env, "VAULT_PRF_SALT_PREFIX", "app-passkey-prf-v1:");
  const defaultRecoveryWordCount =
    input.defaultRecoveryWordCount ??
    readRecoveryWordCount(env, 24);

  return {
    enabled: readBoolEnv(env, "VAULT_ADMIN_ENABLED", false),
    basePath: readStringEnv(env, "VAULT_ADMIN_PATH", "/admin/vault"),
    productName: input.productName ?? readStringEnv(env, "APP_NAME", "Vault App"),
    profile,
    prfSaltPrefix,
    defaultRecoveryWordCount,
    passwordPolicy: {
      enforcement: readEnumEnv(
        env,
        "VAULT_PASSWORD_ENFORCEMENT",
        ["off", "warn", "enforce"] as const,
        "enforce"
      ),
      minLength: readIntEnv(env, "VAULT_PASSWORD_MIN_LENGTH", 12, { min: 1, max: 128 }),
      requireUppercase: readBoolEnv(env, "VAULT_PASSWORD_REQUIRE_UPPERCASE", true),
      requireLowercase: readBoolEnv(env, "VAULT_PASSWORD_REQUIRE_LOWERCASE", true),
      requireNumber: readBoolEnv(env, "VAULT_PASSWORD_REQUIRE_NUMBER", true),
      requireSymbol: readBoolEnv(env, "VAULT_PASSWORD_REQUIRE_SYMBOL", true),
      blockCommonPasswords: readBoolEnv(env, "VAULT_PASSWORD_BLOCK_COMMON_PASSWORDS", true),
      minScore: readIntEnv(env, "VAULT_PASSWORD_MIN_SCORE", 2, { min: 0, max: 4 }),
      strengthPosition: readEnumEnv(
        env,
        "VAULT_PASSWORD_STRENGTH_POSITION",
        ["above", "below"] as const,
        "below"
      ),
    },
    session: {
      autoLockMinutes: readAutoLockMinutes(env),
    },
    features: {
      adminEnabled: readBoolEnv(env, "VAULT_ADMIN_ENABLED", false),
      passkeyPrfUnlockEnabled: readBoolEnv(env, "VAULT_PASSKEY_PRF_UNLOCK_ENABLED", true),
      recoveryPhrase12WordSupported: true,
      recoveryPhrase24WordSupported: true,
    },
  };
}

/** Flat list of resolved configuration entries for admin display tables. */
export function listVaultAdminConfigEntries(
  config: VaultAdminConfig,
  env: Record<string, string | undefined> = {}
): VaultAdminConfigEntry[] {
  const sourceFor = (key: string, defaultValue: unknown): "env" | "default" =>
    hasEnvValue(env, key) ? "env" : "default";

  return [
    {
      key: "enabled",
      envVar: "VAULT_ADMIN_ENABLED",
      label: "Vault admin enabled",
      description: "Whether vault admin routes are enabled in the consuming app.",
      group: "admin",
      value: config.enabled,
      source: sourceFor("VAULT_ADMIN_ENABLED", false),
    },
    {
      key: "basePath",
      envVar: "VAULT_ADMIN_PATH",
      label: "Admin base path",
      description: "Mount path for vault admin pages.",
      group: "admin",
      value: config.basePath,
      source: sourceFor("VAULT_ADMIN_PATH", "/admin/vault"),
    },
    {
      key: "aadContextVault",
      envVar: "VAULT_AAD_CONTEXT_VAULT",
      label: "Vault AAD context",
      description: "Additional authenticated data context for vault payloads.",
      group: "crypto_profile",
      value: config.profile.aadContextVault,
      source: hasEnvValue(env, "VAULT_AAD_CONTEXT_VAULT") ? "env" : "profile",
    },
    {
      key: "aadContextEnvelope",
      envVar: "VAULT_AAD_CONTEXT_ENVELOPE",
      label: "Envelope AAD context",
      description: "Additional authenticated data context for key envelopes.",
      group: "crypto_profile",
      value: config.profile.aadContextEnvelope,
      source: hasEnvValue(env, "VAULT_AAD_CONTEXT_ENVELOPE") ? "env" : "profile",
    },
    {
      key: "prfSaltPrefix",
      envVar: "VAULT_PRF_SALT_PREFIX",
      label: "PRF salt prefix",
      description: "Passkey PRF salt prefix for vault unlock.",
      group: "crypto_profile",
      value: config.prfSaltPrefix,
      source: sourceFor("VAULT_PRF_SALT_PREFIX", config.prfSaltPrefix),
    },
    {
      key: "defaultRecoveryWordCount",
      envVar: "VAULT_DEFAULT_RECOVERY_WORD_COUNT",
      label: "Default recovery word count",
      description: "Default BIP39 phrase length for new vaults.",
      group: "crypto_profile",
      value: config.defaultRecoveryWordCount,
      source: sourceFor("VAULT_DEFAULT_RECOVERY_WORD_COUNT", config.defaultRecoveryWordCount),
    },
    {
      key: "autoLockMinutes",
      envVar: "NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES",
      label: "Auto-lock minutes",
      description: "Inactivity duration before the vault locks.",
      group: "session",
      value: config.session.autoLockMinutes,
      source:
        hasEnvValue(env, "NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES") ||
        hasEnvValue(env, "VAULT_AUTO_LOCK_MINUTES")
          ? "env"
          : "default",
    },
    {
      key: "passwordEnforcement",
      envVar: "VAULT_PASSWORD_ENFORCEMENT",
      label: "Password enforcement",
      description: "Vault password policy enforcement mode.",
      group: "password_policy",
      value: config.passwordPolicy.enforcement,
      source: sourceFor("VAULT_PASSWORD_ENFORCEMENT", "enforce"),
    },
    {
      key: "passwordMinLength",
      envVar: "VAULT_PASSWORD_MIN_LENGTH",
      label: "Password min length",
      description: "Minimum vault password length.",
      group: "password_policy",
      value: config.passwordPolicy.minLength,
      source: sourceFor("VAULT_PASSWORD_MIN_LENGTH", 12),
    },
    {
      key: "passwordMinScore",
      envVar: "VAULT_PASSWORD_MIN_SCORE",
      label: "Password min score",
      description: "Minimum vault password strength score.",
      group: "password_policy",
      value: config.passwordPolicy.minScore,
      source: sourceFor("VAULT_PASSWORD_MIN_SCORE", 2),
    },
    {
      key: "passkeyPrfUnlockEnabled",
      envVar: "VAULT_PASSKEY_PRF_UNLOCK_ENABLED",
      label: "Passkey PRF unlock",
      description: "Whether passkey PRF unlock is enabled.",
      group: "features",
      value: config.features.passkeyPrfUnlockEnabled,
      source: sourceFor("VAULT_PASSKEY_PRF_UNLOCK_ENABLED", true),
    },
    {
      key: "recommendedKdfVersion",
      label: "Recommended KDF version",
      description: "KDF version used for new envelopes and auto-upgrade targets.",
      group: "crypto_profile",
      value: VAULT_CRYPTO_POLICY.kdf.version,
      source: "default",
    },
    {
      key: "encryptionAlgorithm",
      label: "Encryption algorithm",
      description: "Symmetric encryption algorithm for vault payloads.",
      group: "crypto_profile",
      value: VAULT_CRYPTO_POLICY.encryption.alg,
      source: "default",
    },
  ];
}
