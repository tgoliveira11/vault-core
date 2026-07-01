import { VAULT_CRYPTO_POLICY } from "../crypto/policy.js";
import type { VaultCryptoProfile } from "../profile.js";
import { VAULT_CONFIG_KEY_DEFINITIONS } from "./config-keys.js";
import { applyVaultAdminOverrides } from "./config-overrides.js";
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

const DEFAULT_UNLOCK_MAX_FAILURES = 5;
const DEFAULT_UNLOCK_FAILURE_WINDOW_MINUTES = 15;
const DEFAULT_UNLOCK_LOCKOUT_MINUTES = 30;
const DEFAULT_API_MAX_REQUESTS = 120;
const DEFAULT_API_WINDOW_SECONDS = 60;

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

  const baseConfig: VaultAdminConfig = {
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
    rateLimit: {
      unlockMaxFailures: readIntEnv(env, "VAULT_UNLOCK_MAX_FAILURES", DEFAULT_UNLOCK_MAX_FAILURES, {
        min: 1,
        max: 100,
      }),
      unlockFailureWindowMinutes: readIntEnv(
        env,
        "VAULT_UNLOCK_FAILURE_WINDOW_MINUTES",
        DEFAULT_UNLOCK_FAILURE_WINDOW_MINUTES,
        { min: 1, max: 24 * 60 }
      ),
      unlockLockoutMinutes: readIntEnv(
        env,
        "VAULT_UNLOCK_LOCKOUT_MINUTES",
        DEFAULT_UNLOCK_LOCKOUT_MINUTES,
        { min: 1, max: 24 * 60 }
      ),
      apiMaxRequests: readIntEnv(
        env,
        "VAULT_API_RATE_LIMIT_MAX_REQUESTS",
        DEFAULT_API_MAX_REQUESTS,
        { min: 1, max: 10_000 }
      ),
      apiWindowSeconds: readIntEnv(
        env,
        "VAULT_API_RATE_LIMIT_WINDOW_SECONDS",
        DEFAULT_API_WINDOW_SECONDS,
        { min: 1, max: 3600 }
      ),
    },
    features: {
      adminEnabled: readBoolEnv(env, "VAULT_ADMIN_ENABLED", false),
      passkeyPrfUnlockEnabled: readBoolEnv(env, "VAULT_PASSKEY_PRF_UNLOCK_ENABLED", true),
      recoveryPhrase12WordSupported: true,
      recoveryPhrase24WordSupported: true,
    },
  };

  return applyVaultAdminOverrides(baseConfig, input.adminOverrides);
}

/** Flat list of resolved configuration entries for admin display tables. */
export function listVaultAdminConfigEntries(
  config: VaultAdminConfig,
  env: Record<string, string | undefined> = {},
  adminOverrides: Record<string, unknown> = {}
): VaultAdminConfigEntry[] {
  const envHasAutoLock =
    hasEnvValue(env, "NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES") ||
    hasEnvValue(env, "VAULT_AUTO_LOCK_MINUTES");

  function sourceFor(key: string, envVar?: string): VaultAdminConfigEntry["source"] {
    if (Object.prototype.hasOwnProperty.call(adminOverrides, key)) return "admin";
    if (envVar === "NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES" && envHasAutoLock) return "env";
    if (envVar && hasEnvValue(env, envVar)) return "env";
    if (
      (key === "aadContextVault" || key === "aadContextEnvelope") &&
      envVar &&
      !hasEnvValue(env, envVar)
    ) {
      return "profile";
    }
    return "default";
  }

  function valueForKey(key: string): string | number | boolean {
    switch (key) {
      case "enabled":
        return config.enabled;
      case "basePath":
        return config.basePath;
      case "aadContextVault":
        return config.profile.aadContextVault;
      case "aadContextEnvelope":
        return config.profile.aadContextEnvelope;
      case "prfSaltPrefix":
        return config.prfSaltPrefix;
      case "defaultRecoveryWordCount":
        return config.defaultRecoveryWordCount;
      case "autoLockMinutes":
        return config.session.autoLockMinutes;
      case "passwordEnforcement":
        return config.passwordPolicy.enforcement;
      case "passwordMinLength":
        return config.passwordPolicy.minLength;
      case "passwordRequireUppercase":
        return config.passwordPolicy.requireUppercase;
      case "passwordRequireLowercase":
        return config.passwordPolicy.requireLowercase;
      case "passwordRequireNumber":
        return config.passwordPolicy.requireNumber;
      case "passwordRequireSymbol":
        return config.passwordPolicy.requireSymbol;
      case "passwordBlockCommonPasswords":
        return config.passwordPolicy.blockCommonPasswords;
      case "passwordMinScore":
        return config.passwordPolicy.minScore;
      case "passwordStrengthPosition":
        return config.passwordPolicy.strengthPosition;
      case "passkeyPrfUnlockEnabled":
        return config.features.passkeyPrfUnlockEnabled;
      case "unlockMaxFailures":
        return config.rateLimit.unlockMaxFailures;
      case "unlockFailureWindowMinutes":
        return config.rateLimit.unlockFailureWindowMinutes;
      case "unlockLockoutMinutes":
        return config.rateLimit.unlockLockoutMinutes;
      case "apiMaxRequests":
        return config.rateLimit.apiMaxRequests;
      case "apiWindowSeconds":
        return config.rateLimit.apiWindowSeconds;
      case "recommendedKdfVersion":
        return VAULT_CRYPTO_POLICY.kdf.version;
      case "encryptionAlgorithm":
        return VAULT_CRYPTO_POLICY.encryption.alg;
      default:
        throw new Error(`Unknown vault admin config key: ${key}`);
    }
  }

  return VAULT_CONFIG_KEY_DEFINITIONS.map((definition) => ({
    key: definition.key,
    envVar: definition.envVar,
    label: definition.label,
    description: definition.description,
    group: definition.group,
    value: valueForKey(definition.key),
    source: sourceFor(definition.key, definition.envVar),
    overridable: definition.overridable,
  }));
}
