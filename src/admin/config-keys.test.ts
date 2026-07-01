import { describe, expect, it } from "vitest";
import {
  getVaultConfigKeyDefinition,
  isVaultOverridableConfigKey,
  validateVaultAdminOverride,
} from "./config-keys.js";

describe("config-keys", () => {
  it("identifies overridable keys", () => {
    expect(isVaultOverridableConfigKey("passwordMinLength")).toBe(true);
    expect(isVaultOverridableConfigKey("encryptionAlgorithm")).toBe(false);
  });

  it("returns key definitions", () => {
    expect(getVaultConfigKeyDefinition("enabled")?.type).toBe("boolean");
    expect(getVaultConfigKeyDefinition("missing")).toBeUndefined();
  });

  it("validates booleans", () => {
    validateVaultAdminOverride("enabled", true);
    expect(() => validateVaultAdminOverride("enabled", "true")).toThrow(/boolean/i);
  });

  it("validates strings", () => {
    validateVaultAdminOverride("basePath", "/admin");
    expect(() => validateVaultAdminOverride("basePath", "")).toThrow(/non-empty string/i);
    expect(() => validateVaultAdminOverride("basePath", 1)).toThrow(/non-empty string/i);
  });

  it("validates numbers with bounds", () => {
    validateVaultAdminOverride("passwordMinLength", 12);
    expect(() => validateVaultAdminOverride("passwordMinLength", 12.5)).toThrow(/integer/i);
    expect(() => validateVaultAdminOverride("passwordMinLength", 0)).toThrow(/>= 1/);
    expect(() => validateVaultAdminOverride("passwordMinLength", 200)).toThrow(/<= 128/);
    validateVaultAdminOverride("autoLockMinutes", 30);
    expect(() => validateVaultAdminOverride("autoLockMinutes", 0)).toThrow(/>= 1/);
    validateVaultAdminOverride("passwordMinScore", 4);
    expect(() => validateVaultAdminOverride("passwordMinScore", 5)).toThrow(/<= 4/);
  });

  it("validates enums", () => {
    validateVaultAdminOverride("passwordEnforcement", "warn");
    validateVaultAdminOverride("defaultRecoveryWordCount", 12);
    validateVaultAdminOverride("passwordStrengthPosition", "above");
    expect(() => validateVaultAdminOverride("passwordEnforcement", "strict")).toThrow(/one of/i);
  });

  it("rejects unknown keys", () => {
    expect(() => validateVaultAdminOverride("unknown", true)).toThrow(/not overridable/i);
  });
});
