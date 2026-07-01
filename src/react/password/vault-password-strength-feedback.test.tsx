/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VaultAdminPasswordPolicy } from "../../admin/types.js";
import * as vaultPasswordPolicy from "../../validation/vault-password-policy.js";
import { VaultPasswordStrengthFeedback } from "./vault-password-strength-feedback.js";

const policy: VaultAdminPasswordPolicy = {
  enforcement: "off",
  minLength: 12,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSymbol: false,
  blockCommonPasswords: true,
  minScore: 2,
  strengthPosition: "below",
};

function mockValidation(strength: "weak" | "fair" | "good" | "strong" | "empty") {
  const labels = {
    empty: "Empty",
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  } as const;
  const scores = { empty: 0, weak: 1, fair: 2, good: 3, strong: 4 } as const;
  vi.spyOn(vaultPasswordPolicy, "validateVaultPasswordAgainstPolicy").mockReturnValue({
    valid: strength !== "weak",
    strength,
    score: scores[strength],
    strengthLabel: labels[strength],
    failedRequirements: [],
    passedRequirements: [],
    messages: strength === "fair" ? ["Add more variety."] : [],
    assessment: {} as never,
  });
}

describe("VaultPasswordStrengthFeedback", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders an empty-state hint before the user types", () => {
    render(
      <VaultPasswordStrengthFeedback password="" policy={policy} />
    );
    expect(screen.getByText(/Enter your password to see a strength assessment/i)).toBeTruthy();
  });

  it("shows strength feedback even when enforcement is off", () => {
    render(
      <VaultPasswordStrengthFeedback
        password="short"
        policy={policy}
        labelPrefix="Current password strength"
      />
    );

    expect(screen.getByText(/Current password strength:/)).toBeTruthy();
    expect(screen.getByText(/score \d\/4/)).toBeTruthy();
  });

  it("renders tier-specific classes and encouragement", () => {
    for (const strength of ["empty", "weak", "fair", "good", "strong"] as const) {
      cleanup();
      vi.restoreAllMocks();
      mockValidation(strength);
      const { container } = render(
        <VaultPasswordStrengthFeedback password="x" policy={policy} className="custom" />
      );
      expect(container.querySelector(`.vc-password-strength--${strength}`)).toBeTruthy();
    }

    mockValidation("fair");
    render(<VaultPasswordStrengthFeedback password="x" policy={policy} />);
    expect(screen.getByText("Add more variety.")).toBeTruthy();
  });
});
