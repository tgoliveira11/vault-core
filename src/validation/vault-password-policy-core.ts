import type { VaultAdminPasswordPolicy } from "../admin/types.js";

export type VaultPasswordStrengthLabel =
  | "too_short"
  | "common"
  | "weak"
  | "okay"
  | "strong";

export type VaultPasswordAssessment = {
  score: number;
  label: VaultPasswordStrengthLabel;
  messages: string[];
  meetsPolicy: boolean;
};

const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "123456",
    "12345678",
    "123456789",
    "qwerty",
    "abc123",
    "letmein",
    "welcome",
    "monkey",
    "dragon",
    "master",
    "login",
    "princess",
    "football",
    "shadow",
    "sunshine",
    "iloveyou",
    "admin",
    "passw0rd",
  ].map((value) => value.toLowerCase())
);

/** Assesses a vault password against the configured vault password policy. */
export function assessVaultPassword(
  password: string,
  policy: VaultAdminPasswordPolicy
): VaultPasswordAssessment {
  const messages: string[] = [];
  let score = 0;

  if (password.length < policy.minLength) {
    messages.push(`Use at least ${policy.minLength} characters.`);
    return {
      score: 0,
      label: "too_short",
      messages,
      meetsPolicy: policy.enforcement === "off",
    };
  }

  score += 1;

  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const number = /[0-9]/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  const variety = [lower, upper, number, symbol].filter(Boolean).length;

  if (policy.blockCommonPasswords && COMMON_PASSWORDS.has(password.toLowerCase())) {
    messages.push("This password is too common. Choose something more unique.");
    return { score: 0, label: "common", messages, meetsPolicy: false };
  }

  if (policy.requireLowercase && !lower) messages.push("Add a lowercase letter.");
  if (policy.requireUppercase && !upper) messages.push("Add an uppercase letter.");
  if (policy.requireNumber && !number) messages.push("Add a number.");
  if (policy.requireSymbol && !symbol) messages.push("Add a symbol.");

  if (password.length >= policy.minLength + 4) score += 1;
  if (variety >= 3) score += 1;
  if (password.length >= 16 && variety >= 3) score += 1;

  const label: VaultPasswordStrengthLabel =
    score <= 1 ? "weak" : score === 2 ? "okay" : "strong";

  if (label === "weak") {
    messages.push("Try a longer passphrase with mixed character types.");
  }
  if (label === "okay") {
    messages.push("This password is okay. A longer passphrase would be stronger.");
  }

  const meetsRequirements =
    (!policy.requireLowercase || lower) &&
    (!policy.requireUppercase || upper) &&
    (!policy.requireNumber || number) &&
    (!policy.requireSymbol || symbol);

  const meetsPolicy =
    policy.enforcement === "off" ||
    (meetsRequirements && score >= policy.minScore);

  return { score, label, messages, meetsPolicy };
}

export function validateVaultPasswordForSubmission(
  password: string,
  policy: VaultAdminPasswordPolicy
): { valid: boolean; assessment: VaultPasswordAssessment } {
  const assessment = assessVaultPassword(password, policy);
  if (policy.enforcement !== "enforce") {
    return { valid: true, assessment };
  }
  return { valid: assessment.meetsPolicy, assessment };
}

export function getVaultPasswordStrengthDisplay(label: VaultPasswordStrengthLabel): string {
  switch (label) {
    case "too_short":
      return "Too short";
    case "common":
      return "Too common";
    case "weak":
      return "Weak";
    case "okay":
      return "Okay";
    case "strong":
      return "Strong";
  }
}

export function shouldShowVaultPasswordStrengthUi(policy: VaultAdminPasswordPolicy): boolean {
  return policy.enforcement !== "off";
}

export function getVaultPasswordPolicyHint(policy: VaultAdminPasswordPolicy): string | undefined {
  if (policy.enforcement === "off") return undefined;
  return `At least ${policy.minLength} characters.`;
}
