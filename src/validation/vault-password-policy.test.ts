import { describe, expect, it } from "vitest";
import type { VaultAdminPasswordPolicy } from "../admin/types.js";
import {
  assessVaultPassword,
  getVaultPasswordPolicyHint,
  getVaultPasswordStrengthDisplay,
  shouldShowVaultPasswordStrengthUi,
  validateVaultPasswordForSubmission,
} from "./vault-password-policy-core.js";
import {
  calculateVaultPasswordStrength,
  getVaultPasswordEnforcementMessage,
  getVaultPasswordPolicyRequirements,
  validateVaultPasswordAgainstPolicy,
  validateVaultPasswordConfirmation,
  validateVaultPasswordSetup,
} from "./vault-password-policy.js";

const enforcePolicy: VaultAdminPasswordPolicy = {
  enforcement: "enforce",
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
  blockCommonPasswords: true,
  minScore: 2,
  strengthPosition: "below",
};

describe("vault password policy", () => {
  it("rejects common passwords", () => {
    const policy: VaultAdminPasswordPolicy = { ...enforcePolicy, minLength: 8 };
    const assessment = assessVaultPassword("password", policy);
    expect(assessment.label).toBe("common");
    expect(assessment.meetsPolicy).toBe(false);
  });

  it("flags too-short passwords", () => {
    const assessment = assessVaultPassword("short", enforcePolicy);
    expect(assessment.label).toBe("too_short");
    expect(assessment.meetsPolicy).toBe(false);
  });

  it("allows too-short passwords when enforcement is off", () => {
    const offPolicy: VaultAdminPasswordPolicy = { ...enforcePolicy, enforcement: "off" };
    const assessment = assessVaultPassword("short", offPolicy);
    expect(assessment.label).toBe("too_short");
    expect(assessment.meetsPolicy).toBe(true);
  });

  it("adds guidance for weak and okay passwords", () => {
    const weak = assessVaultPassword("abcdefghijkl", {
      ...enforcePolicy,
      requireUppercase: false,
      requireNumber: false,
      requireSymbol: false,
      minScore: 0,
    });
    expect(weak.label).toBe("weak");
    expect(weak.messages.some((message) => /passphrase/i.test(message))).toBe(true);

    const okay = assessVaultPassword("abcdefghijkl1!", {
      ...enforcePolicy,
      requireUppercase: false,
      minScore: 0,
    });
    expect(okay.label).toBe("okay");
    expect(okay.messages.some((message) => /okay/i.test(message))).toBe(true);
  });

  it("validates strong password against enforce policy", () => {
    const result = validateVaultPasswordAgainstPolicy("Riverstone-Kettle-2026!", enforcePolicy);
    expect(result.valid).toBe(true);
    expect(result.strength).toBe("strong");
    expect(result.failedRequirements).toHaveLength(0);
  });

  it("reports failed character requirements", () => {
    const result = validateVaultPasswordAgainstPolicy("riverstonekettle2026", enforcePolicy);
    expect(result.valid).toBe(false);
    expect(result.failedRequirements.some((item) => item.id === "uppercase")).toBe(true);
    expect(result.failedRequirements.some((item) => item.id === "symbol")).toBe(true);
  });

  it("lists static requirements from policy", () => {
    const requirements = getVaultPasswordPolicyRequirements(enforcePolicy);
    expect(requirements.some((item) => item.id === "minLength")).toBe(true);
    expect(requirements.some((item) => item.id === "symbol")).toBe(true);
    expect(requirements.some((item) => item.id === "minScore")).toBe(true);
  });

  it("validates setup with confirmation", () => {
    const setup = validateVaultPasswordSetup({
      password: "Riverstone-Kettle-2026!",
      confirmation: "Riverstone-Kettle-2026!",
      policy: enforcePolicy,
    });
    expect(setup.valid).toBe(true);

    const mismatch = validateVaultPasswordSetup({
      password: "Riverstone-Kettle-2026!",
      confirmation: "other",
      policy: enforcePolicy,
    });
    expect(mismatch.valid).toBe(false);
    expect(mismatch.confirmation.message).toMatch(/do not match/i);
  });

  it("skips confirmation when not required", () => {
    const setup = validateVaultPasswordSetup({
      password: "Riverstone-Kettle-2026!",
      policy: enforcePolicy,
      requireConfirmation: false,
    });
    expect(setup.valid).toBe(true);
    expect(setup.confirmation.matches).toBe(true);
  });

  it("allows weak passwords when enforcement is warn", () => {
    const warnPolicy: VaultAdminPasswordPolicy = { ...enforcePolicy, enforcement: "warn" };
    const submission = validateVaultPasswordForSubmission("short", warnPolicy);
    expect(submission.valid).toBe(true);
  });

  it("rejects weak passwords when enforcement is enforce", () => {
    const submission = validateVaultPasswordForSubmission("short", enforcePolicy);
    expect(submission.valid).toBe(false);
  });

  it("maps strength labels for display", () => {
    expect(getVaultPasswordStrengthDisplay("too_short")).toBe("Too short");
    expect(getVaultPasswordStrengthDisplay("common")).toBe("Too common");
    expect(getVaultPasswordStrengthDisplay("weak")).toBe("Weak");
    expect(getVaultPasswordStrengthDisplay("okay")).toBe("Okay");
    expect(getVaultPasswordStrengthDisplay("strong")).toBe("Strong");
    expect(calculateVaultPasswordStrength("", enforcePolicy)).toBe("empty");
  });

  it("maps fair and good strengths from score", () => {
    expect(
      calculateVaultPasswordStrength("abcdefghijkl1!", {
        ...enforcePolicy,
        requireUppercase: false,
        minScore: 0,
      })
    ).toBe("fair");
    expect(
      calculateVaultPasswordStrength("abcdefghijklm1!", {
        ...enforcePolicy,
        minLength: 8,
        requireUppercase: false,
        minScore: 0,
      })
    ).toBe("good");
  });

  it("returns enforcement messages", () => {
    expect(getVaultPasswordEnforcementMessage({ ...enforcePolicy, enforcement: "off" })).toMatch(
      /disabled/i
    );
    expect(getVaultPasswordEnforcementMessage({ ...enforcePolicy, enforcement: "warn" })).toMatch(
      /warn/i
    );
    expect(getVaultPasswordEnforcementMessage(enforcePolicy)).toMatch(/enforce/i);
  });

  it("validates password confirmation helper", () => {
    expect(validateVaultPasswordConfirmation("abc", "abc")).toBe(true);
    expect(validateVaultPasswordConfirmation("abc", "def")).toBe(false);
    expect(validateVaultPasswordConfirmation("", "abc")).toBe(false);
  });

  it("exposes strength UI helpers", () => {
    expect(shouldShowVaultPasswordStrengthUi(enforcePolicy)).toBe(true);
    expect(shouldShowVaultPasswordStrengthUi({ ...enforcePolicy, enforcement: "off" })).toBe(
      false
    );
    expect(getVaultPasswordPolicyHint(enforcePolicy)).toMatch(/12 characters/);
    expect(getVaultPasswordPolicyHint({ ...enforcePolicy, enforcement: "off" })).toBeUndefined();
  });

  it("omits optional requirements when policy flags are disabled", () => {
    const relaxed: VaultAdminPasswordPolicy = {
      enforcement: "enforce",
      minLength: 8,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSymbol: false,
      blockCommonPasswords: false,
      minScore: 0,
      strengthPosition: "below",
    };

    const requirements = getVaultPasswordPolicyRequirements(relaxed);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.id).toBe("minLength");

    const result = validateVaultPasswordAgainstPolicy("12345678", relaxed);
    expect(result.valid).toBe(true);
    expect(result.passedRequirements.some((item) => item.id === "minLength")).toBe(true);
  });

  it("allows empty password validation result when enforcement is off", () => {
    const offPolicy: VaultAdminPasswordPolicy = { ...enforcePolicy, enforcement: "off" };
    const result = validateVaultPasswordAgainstPolicy("", offPolicy);
    expect(result.valid).toBe(false);
    expect(result.strength).toBe("empty");
  });
});
