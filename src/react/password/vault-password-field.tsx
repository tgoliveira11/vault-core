"use client";

import { useEffect, useId, useMemo, type ReactNode } from "react";
import type { VaultAdminPasswordPolicy } from "../../admin/types.js";
import {
  getVaultPasswordEnforcementMessage,
  getVaultPasswordPolicyRequirements,
  validateVaultPasswordAgainstPolicy,
  type VaultPasswordValidationResult,
} from "../../validation/vault-password-policy.js";
import {
  getVaultPasswordPolicyHint,
  shouldShowVaultPasswordStrengthUi,
} from "../../validation/vault-password-policy-core.js";

export type VaultPasswordFieldProps = {
  id?: string;
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  policy: VaultAdminPasswordPolicy;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onValidityChange?: (valid: boolean, result: VaultPasswordValidationResult) => void;
  showStrength?: boolean;
  hint?: string;
};

function strengthClass(strength: VaultPasswordValidationResult["strength"]): string {
  switch (strength) {
    case "empty":
      return "vc-password-strength--empty";
    case "weak":
      return "vc-password-strength--weak";
    case "fair":
      return "vc-password-strength--fair";
    case "good":
      return "vc-password-strength--good";
    case "strong":
      return "vc-password-strength--strong";
  }
}

function VaultPasswordFeedback({
  policy,
  validation,
  showStrength,
  hint,
}: {
  policy: VaultAdminPasswordPolicy;
  validation: VaultPasswordValidationResult;
  showStrength: boolean;
  hint?: string;
}) {
  const enforcementMessage = getVaultPasswordEnforcementMessage(policy);
  const staticRequirements = getVaultPasswordPolicyRequirements(policy);
  const requirements =
    validation.strength === "empty"
      ? staticRequirements
      : [...validation.passedRequirements, ...validation.failedRequirements];

  return (
    <div className="vc-password-feedback">
      {enforcementMessage ? (
        <p className="vc-password-feedback-enforcement">{enforcementMessage}</p>
      ) : null}
      {validation.strength === "empty" && hint ? (
        <p className="vc-password-feedback-hint">{hint}</p>
      ) : null}
      {showStrength && validation.strength !== "empty" ? (
        <p className={`vc-password-strength ${strengthClass(validation.strength)}`}>
          Strength: {validation.strengthLabel} · score {validation.score}/4
        </p>
      ) : null}
      {requirements.length > 0 ? (
        <ul className="vc-password-requirements">
          {requirements.map((requirement) => (
            <li
              key={requirement.id}
              className={
                requirement.met
                  ? "vc-password-requirement vc-password-requirement--met"
                  : "vc-password-requirement"
              }
            >
              {requirement.met ? "✓" : "○"} {requirement.label}
            </li>
          ))}
        </ul>
      ) : null}
      {validation.messages.map((message) => (
        <p key={message} className="vc-password-message">
          {message}
        </p>
      ))}
    </div>
  );
}

export function VaultPasswordField({
  id,
  label = "Vault password",
  value,
  onChange,
  policy,
  placeholder,
  autoComplete,
  disabled = false,
  required = true,
  className,
  onValidityChange,
  showStrength = true,
  hint,
}: VaultPasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const showStrengthFeedback = showStrength && shouldShowVaultPasswordStrengthUi(policy);
  const validation = useMemo(
    () => validateVaultPasswordAgainstPolicy(value, policy),
    [value, policy]
  );
  const resolvedHint = hint ?? getVaultPasswordPolicyHint(policy);
  const feedback = (
    <VaultPasswordFeedback
      policy={policy}
      validation={validation}
      showStrength={showStrengthFeedback}
      hint={resolvedHint}
    />
  );

  useEffect(() => {
    onValidityChange?.(validation.valid, validation);
  }, [onValidityChange, validation]);

  const input = (
    <input
      id={fieldId}
      type="password"
      className="vc-admin-input w-full"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      required={required}
      minLength={policy.enforcement === "off" ? undefined : policy.minLength}
      aria-describedby={`${fieldId}-feedback`}
    />
  );

  return (
    <div className={className ? `vc-password-field ${className}` : "vc-password-field"}>
      <label htmlFor={fieldId} className="block text-sm">
        <span className="mb-1 block font-medium">{label}</span>
        {policy.strengthPosition === "above" && showStrengthFeedback ? (
          <div id={`${fieldId}-feedback`} className="mb-2">
            {feedback}
          </div>
        ) : null}
        {input}
        {policy.strengthPosition === "below" && showStrengthFeedback ? (
          <div id={`${fieldId}-feedback`} className="mt-2">
            {feedback}
          </div>
        ) : null}
        {!showStrengthFeedback ? (
          <div id={`${fieldId}-feedback`} className="mt-2">
            {feedback}
          </div>
        ) : null}
      </label>
    </div>
  );
}

export type VaultPasswordSetupFieldsProps = {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  policy: VaultAdminPasswordPolicy;
  passwordLabel?: ReactNode;
  confirmationLabel?: ReactNode;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
};

export function VaultPasswordSetupFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  policy,
  passwordLabel = "Vault password",
  confirmationLabel = "Confirm password",
  disabled = false,
  onValidityChange,
}: VaultPasswordSetupFieldsProps) {
  const mismatch =
    confirmation.length > 0 && password.length > 0 && password !== confirmation;

  useEffect(() => {
    if (!onValidityChange) return;
    const passwordValid = validateVaultPasswordAgainstPolicy(password, policy).valid;
    const confirmValid = confirmation.length > 0 && password === confirmation;
    onValidityChange(passwordValid && confirmValid);
  }, [password, confirmation, policy, onValidityChange]);

  return (
    <div className="space-y-4">
      <VaultPasswordField
        id="vault-password"
        label={passwordLabel}
        value={password}
        onChange={onPasswordChange}
        policy={policy}
        autoComplete="new-password"
        disabled={disabled}
      />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{confirmationLabel}</span>
        <input
          type="password"
          className="vc-admin-input w-full"
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.target.value)}
          autoComplete="new-password"
          disabled={disabled}
          required
        />
        {mismatch ? (
          <p className="vc-password-message mt-2">Passwords do not match.</p>
        ) : null}
      </label>
    </div>
  );
}
