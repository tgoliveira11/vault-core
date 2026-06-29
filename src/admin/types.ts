import type { VaultCryptoProfile } from "../profile.js";

export type VaultAdminEnvSource = "env" | "default" | "profile";

export type VaultPasswordEnforcement = "off" | "warn" | "enforce";

export type VaultPasswordStrengthPosition = "above" | "below";

export type VaultAdminPasswordPolicy = {
  enforcement: VaultPasswordEnforcement;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  blockCommonPasswords: boolean;
  minScore: number;
  strengthPosition: VaultPasswordStrengthPosition;
};

export type VaultAdminSessionConfig = {
  autoLockMinutes: number;
};

export type VaultAdminFeatureFlags = {
  adminEnabled: boolean;
  passkeyPrfUnlockEnabled: boolean;
  recoveryPhrase12WordSupported: boolean;
  recoveryPhrase24WordSupported: boolean;
};

export type VaultAdminConfigInput = {
  env?: Record<string, string | undefined>;
  profile?: VaultCryptoProfile;
  prfSaltPrefix?: string;
  productName?: string;
  defaultRecoveryWordCount?: 12 | 24;
};

export type VaultAdminConfig = {
  enabled: boolean;
  basePath: string;
  productName: string;
  profile: VaultCryptoProfile;
  prfSaltPrefix: string;
  defaultRecoveryWordCount: 12 | 24;
  passwordPolicy: VaultAdminPasswordPolicy;
  session: VaultAdminSessionConfig;
  features: VaultAdminFeatureFlags;
};

export type VaultAdminConfigEntry = {
  key: string;
  envVar?: string;
  label: string;
  description: string;
  group: VaultAdminConfigGroup;
  value: string | number | boolean;
  source: VaultAdminEnvSource;
  sensitive?: boolean;
};

export type VaultAdminConfigGroup =
  | "admin"
  | "crypto_profile"
  | "session"
  | "password_policy"
  | "features";

export type VaultAdminPaths = {
  panel: string;
  config: string;
  cryptoPolicy: string;
  profile: string;
  session: string;
  passwordPolicy: string;
  security: string;
  envTemplate: string;
};

export type VaultAdminSection = {
  key: keyof VaultAdminPaths;
  label: string;
  description: string;
};
