import { describe, expect, it } from "vitest";
import { validateVaultAdminOverride } from "./config-keys.js";
import { applyVaultAdminOverrides } from "./config-overrides.js";
import { buildVaultAdminConfigFromEnv, listVaultAdminConfigEntries } from "./resolve-config.js";

const baseInput = {
  productName: "Test App",
  profile: {
    cryptoVersion: "vault-v1" as const,
    aadContextVault: "test:vault:v1",
    aadContextEnvelope: "test:envelope:v1",
  },
};

describe("admin config overrides", () => {
  it("applies admin overrides with highest priority", () => {
    const config = buildVaultAdminConfigFromEnv({
      ...baseInput,
      env: {
        VAULT_ADMIN_ENABLED: "false",
        VAULT_PASSWORD_MIN_LENGTH: "16",
        NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES: "20",
      },
      adminOverrides: {
        enabled: true,
        passwordMinLength: 24,
        autoLockMinutes: 45,
      },
    });

    expect(config.enabled).toBe(true);
    expect(config.passwordPolicy.minLength).toBe(24);
    expect(config.session.autoLockMinutes).toBe(45);
  });

  it("marks admin-sourced entries", () => {
    const config = buildVaultAdminConfigFromEnv({
      ...baseInput,
      adminOverrides: { passwordMinLength: 18 },
    });
    const entries = listVaultAdminConfigEntries(config, {}, { passwordMinLength: 18 });
    expect(entries.find((entry) => entry.key === "passwordMinLength")?.source).toBe("admin");
  });

  it("prefers admin over env in source badges", () => {
    const config = buildVaultAdminConfigFromEnv({
      ...baseInput,
      env: { VAULT_PASSWORD_MIN_LENGTH: "16" },
      adminOverrides: { passwordMinLength: 20 },
    });
    const entries = listVaultAdminConfigEntries(
      config,
      { VAULT_PASSWORD_MIN_LENGTH: "16" },
      { passwordMinLength: 20 }
    );
    expect(entries.find((entry) => entry.key === "passwordMinLength")?.source).toBe("admin");
    expect(entries.find((entry) => entry.key === "passwordMinLength")?.value).toBe(20);
  });

  it("rejects non-overridable keys", () => {
    expect(() => validateVaultAdminOverride("encryptionAlgorithm", "aes")).toThrow(
      /not overridable/i
    );
  });

  it("validates override value types", () => {
    expect(() => validateVaultAdminOverride("passwordMinLength", "12")).toThrow(/integer/i);
    expect(() => validateVaultAdminOverride("passwordEnforcement", "strict")).toThrow(/one of/i);
  });

  it("coerces recovery word count from admin override", () => {
    const base = buildVaultAdminConfigFromEnv(baseInput);
    const next = applyVaultAdminOverrides(base, { defaultRecoveryWordCount: 12 });
    expect(next.defaultRecoveryWordCount).toBe(12);
  });

  it("applies every overridable field", () => {
    const base = buildVaultAdminConfigFromEnv(baseInput);
    const next = applyVaultAdminOverrides(base, {
      enabled: true,
      basePath: "/custom/admin",
      aadContextVault: "custom:vault",
      aadContextEnvelope: "custom:envelope",
      prfSaltPrefix: "custom-prf:",
      defaultRecoveryWordCount: 24,
      autoLockMinutes: 10,
      passwordEnforcement: "warn",
      passwordMinLength: 10,
      passwordRequireUppercase: false,
      passwordRequireLowercase: false,
      passwordRequireNumber: false,
      passwordRequireSymbol: false,
      passwordBlockCommonPasswords: false,
      passwordMinScore: 1,
      passwordStrengthPosition: "above",
      passkeyPrfUnlockEnabled: false,
    });

    expect(next.enabled).toBe(true);
    expect(next.features.adminEnabled).toBe(true);
    expect(next.basePath).toBe("/custom/admin");
    expect(next.profile.aadContextVault).toBe("custom:vault");
    expect(next.profile.aadContextEnvelope).toBe("custom:envelope");
    expect(next.prfSaltPrefix).toBe("custom-prf:");
    expect(next.defaultRecoveryWordCount).toBe(24);
    expect(next.session.autoLockMinutes).toBe(10);
    expect(next.passwordPolicy.enforcement).toBe("warn");
    expect(next.passwordPolicy.minLength).toBe(10);
    expect(next.passwordPolicy.requireUppercase).toBe(false);
    expect(next.passwordPolicy.requireLowercase).toBe(false);
    expect(next.passwordPolicy.requireNumber).toBe(false);
    expect(next.passwordPolicy.requireSymbol).toBe(false);
    expect(next.passwordPolicy.blockCommonPasswords).toBe(false);
    expect(next.passwordPolicy.minScore).toBe(1);
    expect(next.passwordPolicy.strengthPosition).toBe("above");
    expect(next.features.passkeyPrfUnlockEnabled).toBe(false);
  });

  it("returns the same config when overrides are empty", () => {
    const base = buildVaultAdminConfigFromEnv(baseInput);
    expect(applyVaultAdminOverrides(base, {})).toBe(base);
  });
});
