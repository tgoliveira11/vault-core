"use client";

import { useMemo } from "react";
import type { VaultAdminPasswordPolicy } from "../../admin/types.js";
import { validateVaultPasswordAgainstPolicy } from "../../validation/vault-password-policy.js";
import type { VaultPasswordStrength } from "../../validation/vault-password-policy.js";

export type VaultPasswordStrengthFeedbackProps = {
  password: string;
  policy: VaultAdminPasswordPolicy;
  className?: string;
  /** Prefix for the strength line (default: "Password strength"). */
  labelPrefix?: string;
};

function strengthClass(strength: VaultPasswordStrength): string {
  const classes: Record<VaultPasswordStrength, string> = {
    empty: "vc-password-strength--empty",
    weak: "vc-password-strength--weak",
    fair: "vc-password-strength--fair",
    good: "vc-password-strength--good",
    strong: "vc-password-strength--strong",
  };
  return classes[strength];
}

const ENCOURAGEMENT_BY_STRENGTH: Partial<Record<VaultPasswordStrength, string>> = {
  weak: "Consider a longer passphrase with mixed character types for stronger vault protection.",
  fair: "Consider a longer passphrase with mixed character types for stronger vault protection.",
  good: "Good strength. A longer passphrase would make this vault password even safer.",
  strong: "Strong vault password.",
};

function encouragementForStrength(strength: VaultPasswordStrength): string | null {
  return ENCOURAGEMENT_BY_STRENGTH[strength] ?? null;
}

/** Read-only strength feedback for an existing vault password (awareness only; does not block submit). */
export function VaultPasswordStrengthFeedback({
  password,
  policy,
  className,
  labelPrefix = "Password strength",
}: VaultPasswordStrengthFeedbackProps) {
  const validation = useMemo(
    () => validateVaultPasswordAgainstPolicy(password, policy),
    [password, policy]
  );

  if (!password) {
    return (
      <div className={className ?? "vc-password-feedback"}>
        <p className="vc-password-feedback-hint">
          Enter your password to see a strength assessment.
        </p>
      </div>
    );
  }

  const encouragement = encouragementForStrength(validation.strength);

  return (
    <div className={className ?? "vc-password-feedback"}>
      <p className={`vc-password-strength ${strengthClass(validation.strength)}`}>
        {labelPrefix}: {validation.strengthLabel} · score {validation.score}/4
      </p>
      {encouragement ? <p className="vc-password-feedback-hint">{encouragement}</p> : null}
      {validation.messages.map((message) => (
        <p key={message} className="vc-password-message">
          {message}
        </p>
      ))}
    </div>
  );
}
