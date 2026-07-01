import type { VaultAdminPasswordPolicy } from "../admin/types.js";
import {
  assessVaultPassword,
  getVaultPasswordStrengthDisplay,
  type VaultPasswordAssessment,
  type VaultPasswordStrengthLabel,
} from "./vault-password-policy-core.js";

export type VaultPasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

export type VaultPasswordRequirementId =
  | "minLength"
  | "uppercase"
  | "lowercase"
  | "number"
  | "symbol"
  | "common"
  | "minScore";

export type VaultPasswordRequirement = {
  id: VaultPasswordRequirementId;
  label: string;
  met: boolean;
};

export type VaultPasswordValidationResult = {
  valid: boolean;
  strength: VaultPasswordStrength;
  score: number;
  strengthLabel: string;
  failedRequirements: VaultPasswordRequirement[];
  passedRequirements: VaultPasswordRequirement[];
  messages: string[];
  assessment: VaultPasswordAssessment;
};

export type VaultPasswordSetupValidationResult = {
  valid: boolean;
  password: VaultPasswordValidationResult;
  confirmation: {
    valid: boolean;
    matches: boolean;
    message?: string;
  };
};

function mapStrengthLabel(
  password: string,
  label: VaultPasswordStrengthLabel,
  score: number
): VaultPasswordStrength {
  if (!password) return "empty";
  if (label === "too_short" || label === "common") return "weak";
  if (label === "weak" || score <= 1) return "weak";
  if (score >= 4) return "strong";
  if (score >= 3) return "good";
  return "fair";
}

function buildRequirementList(
  password: string,
  policy: VaultAdminPasswordPolicy,
  assessment: VaultPasswordAssessment
): { passed: VaultPasswordRequirement[]; failed: VaultPasswordRequirement[] } {
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const number = /[0-9]/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);

  const candidates: VaultPasswordRequirement[] = [
    {
      id: "minLength",
      label: `At least ${policy.minLength} characters`,
      met: password.length >= policy.minLength,
    },
  ];

  if (policy.requireUppercase) {
    candidates.push({ id: "uppercase", label: "Uppercase letter", met: upper });
  }
  if (policy.requireLowercase) {
    candidates.push({ id: "lowercase", label: "Lowercase letter", met: lower });
  }
  if (policy.requireNumber) {
    candidates.push({ id: "number", label: "Number", met: number });
  }
  if (policy.requireSymbol) {
    candidates.push({ id: "symbol", label: "Symbol", met: symbol });
  }
  if (policy.blockCommonPasswords && password.length > 0) {
    candidates.push({
      id: "common",
      label: "Not a common password",
      met: assessment.label !== "common",
    });
  }
  if (policy.minScore > 0 && password.length >= policy.minLength) {
    candidates.push({
      id: "minScore",
      label: `Strength score at least ${policy.minScore} (current: ${assessment.score})`,
      met: assessment.score >= policy.minScore,
    });
  }

  return {
    passed: candidates.filter((item) => item.met),
    failed: candidates.filter((item) => !item.met),
  };
}

/** Static checklist of active policy rules (for empty password guidance). */
export function getVaultPasswordPolicyRequirements(
  policy: VaultAdminPasswordPolicy
): VaultPasswordRequirement[] {
  const requirements: VaultPasswordRequirement[] = [
    { id: "minLength", label: `At least ${policy.minLength} characters`, met: false },
  ];
  if (policy.requireUppercase) {
    requirements.push({ id: "uppercase", label: "Uppercase letter", met: false });
  }
  if (policy.requireLowercase) {
    requirements.push({ id: "lowercase", label: "Lowercase letter", met: false });
  }
  if (policy.requireNumber) {
    requirements.push({ id: "number", label: "Number", met: false });
  }
  if (policy.requireSymbol) {
    requirements.push({ id: "symbol", label: "Symbol", met: false });
  }
  if (policy.blockCommonPasswords) {
    requirements.push({ id: "common", label: "Not a common password", met: false });
  }
  if (policy.minScore > 0) {
    requirements.push({
      id: "minScore",
      label: `Strength score at least ${policy.minScore}`,
      met: false,
    });
  }
  return requirements;
}

export function calculateVaultPasswordStrength(
  password: string,
  policy: VaultAdminPasswordPolicy
): VaultPasswordStrength {
  if (!password) return "empty";
  const assessment = assessVaultPassword(password, policy);
  return mapStrengthLabel(password, assessment.label, assessment.score);
}

export function validateVaultPasswordAgainstPolicy(
  password: string,
  policy: VaultAdminPasswordPolicy
): VaultPasswordValidationResult {
  const assessment = assessVaultPassword(password, policy);
  const { passed, failed } = buildRequirementList(password, policy, assessment);
  const strength = mapStrengthLabel(password, assessment.label, assessment.score);

  const valid =
    password.length > 0 &&
    failed.length === 0 &&
    (policy.enforcement === "off" || assessment.meetsPolicy);

  return {
    valid,
    strength,
    score: assessment.score,
    strengthLabel: getVaultPasswordStrengthDisplay(assessment.label),
    failedRequirements: failed,
    passedRequirements: passed,
    messages: assessment.messages,
    assessment,
  };
}

export function validateVaultPasswordConfirmation(
  password: string,
  confirmation: string
): boolean {
  return password.length > 0 && confirmation.length > 0 && password === confirmation;
}

export function validateVaultPasswordSetup(input: {
  password: string;
  confirmation?: string;
  policy: VaultAdminPasswordPolicy;
  requireConfirmation?: boolean;
  confirmationMismatchMessage?: string;
}): VaultPasswordSetupValidationResult {
  const requireConfirmation = input.requireConfirmation !== false;
  const passwordResult = validateVaultPasswordAgainstPolicy(input.password, input.policy);
  const mismatchMessage = input.confirmationMismatchMessage ?? "Passwords do not match.";

  if (!requireConfirmation) {
    return {
      valid: passwordResult.valid,
      password: passwordResult,
      confirmation: { valid: true, matches: true },
    };
  }

  const confirmationValue = input.confirmation ?? "";
  const matches = validateVaultPasswordConfirmation(input.password, confirmationValue);
  const confirmation = {
    valid: matches,
    matches,
    message: matches ? undefined : mismatchMessage,
  };

  return {
    valid: passwordResult.valid && confirmation.valid,
    password: passwordResult,
    confirmation,
  };
}

export function getVaultPasswordEnforcementMessage(
  policy: VaultAdminPasswordPolicy
): string | undefined {
  switch (policy.enforcement) {
    case "off":
      return "Password policy is disabled (enforcement: off).";
    case "warn":
      return "Policy feedback is shown; weak passwords are allowed (enforcement: warn).";
    case "enforce":
      return "Password must meet all requirements below (enforcement: enforce).";
  }
}
