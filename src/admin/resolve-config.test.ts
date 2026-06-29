import { describe, expect, it } from "vitest";
import {
  buildVaultAdminConfigFromEnv,
  listVaultAdminConfigEntries,
} from "./resolve-config.js";
import { buildVaultEnvLocalTemplate, VAULT_ADMIN_ENV_CATALOG } from "./env-catalog.js";
import { listVaultAdminScreens, resolveVaultAdminPaths } from "./paths.js";
import { readBoolEnv, readEnumEnv, readIntEnv } from "./env-parse.js";

describe("buildVaultAdminConfigFromEnv", () => {
  it("resolves defaults without env overrides", () => {
    const config = buildVaultAdminConfigFromEnv({
      productName: "Test App",
      profile: {
        cryptoVersion: "vault-v1",
        aadContextVault: "test:vault:v1",
        aadContextEnvelope: "test:envelope:v1",
      },
    });

    expect(config.enabled).toBe(false);
    expect(config.basePath).toBe("/admin/vault");
    expect(config.passwordPolicy.enforcement).toBe("enforce");
    expect(config.session.autoLockMinutes).toBe(15);
    expect(config.profile.aadContextVault).toBe("test:vault:v1");
  });

  it("reads env overrides", () => {
    const config = buildVaultAdminConfigFromEnv({
      env: {
        VAULT_ADMIN_ENABLED: "true",
        VAULT_ADMIN_PATH: "/ops/vault",
        VAULT_PASSWORD_ENFORCEMENT: "warn",
        VAULT_PASSWORD_MIN_LENGTH: "20",
        NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES: "30",
        VAULT_DEFAULT_RECOVERY_WORD_COUNT: "12",
      },
    });

    expect(config.enabled).toBe(true);
    expect(config.basePath).toBe("/ops/vault");
    expect(config.passwordPolicy.enforcement).toBe("warn");
    expect(config.passwordPolicy.minLength).toBe(20);
    expect(config.session.autoLockMinutes).toBe(30);
    expect(config.defaultRecoveryWordCount).toBe(12);
  });

  it("builds profile from env when profile prop is omitted", () => {
    const config = buildVaultAdminConfigFromEnv({
      env: {
        VAULT_AAD_CONTEXT_VAULT: "app:vault:prod",
        VAULT_AAD_CONTEXT_ENVELOPE: "app:env:prod",
      },
    });

    expect(config.profile.aadContextVault).toBe("app:vault:prod");
    expect(config.profile.aadContextEnvelope).toBe("app:env:prod");
  });
});

describe("listVaultAdminConfigEntries", () => {
  it("marks env-sourced values", () => {
    const config = buildVaultAdminConfigFromEnv({
      env: { VAULT_ADMIN_ENABLED: "true" },
    });
    const entries = listVaultAdminConfigEntries(config, { VAULT_ADMIN_ENABLED: "true" });
    const enabled = entries.find((entry) => entry.key === "enabled");
    expect(enabled?.source).toBe("env");
  });
});

describe("paths and catalog", () => {
  it("resolves admin paths from base path", () => {
    expect(resolveVaultAdminPaths("/admin/vault").config).toBe("/admin/vault/config");
    expect(resolveVaultAdminPaths("/admin/vault/").config).toBe("/admin/vault/config");
    expect(resolveVaultAdminPaths("").panel).toBe("/admin/vault");
  });

  it("lists admin screens including panel", () => {
    const screens = listVaultAdminScreens();
    expect(screens.some((screen) => screen.pathKey === "panel")).toBe(true);
    expect(screens.length).toBeGreaterThan(7);
  });

  it("builds env template with catalog entries", () => {
    const template = buildVaultEnvLocalTemplate("Demo");
    expect(template).toContain("VAULT_ADMIN_ENABLED=true");
    expect(VAULT_ADMIN_ENV_CATALOG.length).toBeGreaterThan(10);
  });
});

describe("env-parse", () => {
  it("throws on invalid boolean", () => {
    expect(() => readBoolEnv({ FOO: "maybe" }, "FOO", false)).toThrow(/boolean/i);
  });

  it("throws on invalid integer and bounds", () => {
    expect(() => readIntEnv({ FOO: "1.5" }, "FOO", 1)).toThrow(/integer/i);
    expect(() => readIntEnv({ FOO: "0" }, "FOO", 1, { min: 1 })).toThrow(/>= 1/);
    expect(() => readIntEnv({ FOO: "200" }, "FOO", 1, { max: 128 })).toThrow(/<= 128/);
  });

  it("throws on invalid enum", () => {
    expect(() =>
      readEnumEnv({ FOO: "bad" }, "FOO", ["off", "warn"] as const, "off")
    ).toThrow(/one of/i);
  });

  it("throws on invalid auto-lock and recovery word count", () => {
    expect(() =>
      buildVaultAdminConfigFromEnv({ env: { NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES: "abc" } })
    ).toThrow(/integer/i);
    expect(() =>
      buildVaultAdminConfigFromEnv({ env: { VAULT_DEFAULT_RECOVERY_WORD_COUNT: "18" } })
    ).toThrow(/12 or 24/);
    expect(() =>
      buildVaultAdminConfigFromEnv({ env: { VAULT_AUTO_LOCK_MINUTES: "0" } })
    ).toThrow(/between/);
  });

  it("uses VAULT_AUTO_LOCK_MINUTES fallback", () => {
    const config = buildVaultAdminConfigFromEnv({
      env: { VAULT_AUTO_LOCK_MINUTES: "45" },
    });
    expect(config.session.autoLockMinutes).toBe(45);
  });

  it("marks profile-sourced AAD entries", () => {
    const config = buildVaultAdminConfigFromEnv({
      profile: {
        cryptoVersion: "vault-v1",
        aadContextVault: "from-profile",
        aadContextEnvelope: "from-profile-env",
      },
    });
    const entries = listVaultAdminConfigEntries(config, {});
    expect(entries.find((e) => e.key === "aadContextVault")?.source).toBe("profile");
  });
});
