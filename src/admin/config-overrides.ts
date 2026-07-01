import type { VaultAdminConfig } from "./types.js";
import { validateVaultAdminOverride } from "./config-keys.js";

export type VaultAdminConfigOverrideRecord = Record<string, unknown>;

export function applyVaultAdminOverrides(
  config: VaultAdminConfig,
  overrides: VaultAdminConfigOverrideRecord = {}
): VaultAdminConfig {
  if (Object.keys(overrides).length === 0) return config;

  const next: VaultAdminConfig = {
    ...config,
    profile: { ...config.profile },
    passwordPolicy: { ...config.passwordPolicy },
    session: { ...config.session },
    features: { ...config.features },
    rateLimit: { ...config.rateLimit },
  };

  for (const [key, rawValue] of Object.entries(overrides)) {
    validateVaultAdminOverride(key, rawValue);

    switch (key) {
      case "enabled":
        next.enabled = rawValue as boolean;
        next.features = { ...next.features, adminEnabled: rawValue as boolean };
        break;
      case "basePath":
        next.basePath = rawValue as string;
        break;
      case "prfSaltPrefix":
        next.prfSaltPrefix = rawValue as string;
        break;
      case "defaultRecoveryWordCount": {
        const count = Number(rawValue);
        next.defaultRecoveryWordCount = count === 12 ? 12 : 24;
        break;
      }
      case "autoLockMinutes":
        next.session = { ...next.session, autoLockMinutes: rawValue as number };
        break;
      case "passwordEnforcement":
        next.passwordPolicy = {
          ...next.passwordPolicy,
          enforcement: rawValue as VaultAdminConfig["passwordPolicy"]["enforcement"],
        };
        break;
      case "passwordMinLength":
        next.passwordPolicy = { ...next.passwordPolicy, minLength: rawValue as number };
        break;
      case "passwordRequireUppercase":
        next.passwordPolicy = { ...next.passwordPolicy, requireUppercase: rawValue as boolean };
        break;
      case "passwordRequireLowercase":
        next.passwordPolicy = { ...next.passwordPolicy, requireLowercase: rawValue as boolean };
        break;
      case "passwordRequireNumber":
        next.passwordPolicy = { ...next.passwordPolicy, requireNumber: rawValue as boolean };
        break;
      case "passwordRequireSymbol":
        next.passwordPolicy = { ...next.passwordPolicy, requireSymbol: rawValue as boolean };
        break;
      case "passwordBlockCommonPasswords":
        next.passwordPolicy = {
          ...next.passwordPolicy,
          blockCommonPasswords: rawValue as boolean,
        };
        break;
      case "passwordMinScore":
        next.passwordPolicy = { ...next.passwordPolicy, minScore: rawValue as number };
        break;
      case "passwordStrengthPosition":
        next.passwordPolicy = {
          ...next.passwordPolicy,
          strengthPosition: rawValue as VaultAdminConfig["passwordPolicy"]["strengthPosition"],
        };
        break;
      case "passkeyPrfUnlockEnabled":
        next.features = { ...next.features, passkeyPrfUnlockEnabled: rawValue as boolean };
        break;
      case "unlockMaxFailures":
        next.rateLimit = { ...next.rateLimit, unlockMaxFailures: rawValue as number };
        break;
      case "unlockFailureWindowMinutes":
        next.rateLimit = {
          ...next.rateLimit,
          unlockFailureWindowMinutes: rawValue as number,
        };
        break;
      case "unlockLockoutMinutes":
        next.rateLimit = { ...next.rateLimit, unlockLockoutMinutes: rawValue as number };
        break;
      case "apiMaxRequests":
        next.rateLimit = { ...next.rateLimit, apiMaxRequests: rawValue as number };
        break;
      case "apiWindowSeconds":
        next.rateLimit = { ...next.rateLimit, apiWindowSeconds: rawValue as number };
        break;
    }
  }

  return next;
}
