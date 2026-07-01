/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VaultAdminPasswordPolicy } from "../../admin/types.js";
import { VaultPasswordField, VaultPasswordSetupFields } from "./vault-password-field.js";

const policy: VaultAdminPasswordPolicy = {
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

describe("VaultPasswordField", () => {
  afterEach(() => cleanup());

  it("shows policy requirements and strength feedback", () => {
    render(
      <VaultPasswordField
        label="Vault password"
        value="Riverstone-Kettle-2026!"
        onChange={() => {}}
        policy={policy}
      />
    );

    expect(screen.getByText(/enforcement: enforce/i)).toBeTruthy();
    expect(screen.getByText(/Strength:/)).toBeTruthy();
    expect(screen.getByText(/At least 12 characters/)).toBeTruthy();
  });

  it("shows feedback above the input when configured", () => {
    render(
      <VaultPasswordField
        value="Riverstone-Kettle-2026!"
        onChange={() => {}}
        policy={{ ...policy, strengthPosition: "above" }}
      />
    );

    const feedback = screen.getByText(/Strength:/).closest(".vc-password-feedback");
    const input = screen.getByLabelText(/Vault password/i);
    expect(feedback?.compareDocumentPosition(input!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows static requirements and hint for empty password", () => {
    render(
      <VaultPasswordField
        value=""
        onChange={() => {}}
        policy={policy}
        hint="Choose a strong passphrase."
      />
    );

    expect(screen.getByText(/Choose a strong passphrase/i)).toBeTruthy();
    expect(screen.getAllByText(/At least 12 characters/).length).toBeGreaterThan(0);
  });

  it("hides strength meter when enforcement is off", () => {
    render(
      <VaultPasswordField
        value="Riverstone-Kettle-2026!"
        onChange={() => {}}
        policy={{ ...policy, enforcement: "off" }}
      />
    );

    expect(screen.queryByText(/Strength:/)).toBeNull();
  });

  it("shows current-password awareness strength even when enforcement is off", () => {
    render(
      <VaultPasswordField
        label="Current password"
        value="Riverstone-Kettle-2026!"
        onChange={() => {}}
        policy={{ ...policy, enforcement: "off" }}
        showRequirements={false}
        showStrengthWhenEnforcementOff
        strengthLabelPrefix="Current password strength"
        emptyStrengthHint="Enter your current password to see how strong it is."
      />
    );

    expect(screen.getByText(/Current password strength:/)).toBeTruthy();
    expect(screen.queryByText(/At least 12 characters/)).toBeNull();
  });

  it("shows empty strength hint for awareness fields", () => {
    render(
      <VaultPasswordField
        label="Current password"
        value=""
        onChange={() => {}}
        policy={policy}
        showRequirements={false}
        showStrengthWhenEnforcementOff
        emptyStrengthHint="Enter your current password to see how strong it is."
      />
    );

    expect(screen.getByText(/Enter your current password to see how strong it is/i)).toBeTruthy();
  });

  it("reports validity changes", () => {
    const onValidityChange = vi.fn();
    const { rerender } = render(
      <VaultPasswordField
        value=""
        onChange={() => {}}
        policy={policy}
        onValidityChange={onValidityChange}
      />
    );

    rerender(
      <VaultPasswordField
        value="Riverstone-Kettle-2026!"
        onChange={() => {}}
        policy={policy}
        onValidityChange={onValidityChange}
      />
    );

    expect(onValidityChange).toHaveBeenCalled();
    const lastCall = onValidityChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(true);
  });

  it("forwards input changes", () => {
    const onChange = vi.fn();
    render(<VaultPasswordField value="" onChange={onChange} policy={policy} />);

    fireEvent.change(screen.getByLabelText(/Vault password/i), {
      target: { value: "Riverstone-Kettle-2026!" },
    });

    expect(onChange).toHaveBeenCalledWith("Riverstone-Kettle-2026!");
  });

  it("renders strength classes across password quality levels", () => {
    const cases: Array<{ value: string; className: string; policyOverride?: Partial<VaultAdminPasswordPolicy> }> = [
      { value: "", className: "vc-password-strength--empty" },
      { value: "short", className: "vc-password-strength--weak" },
      {
        value: "abcdefghijkl1!",
        className: "vc-password-strength--fair",
        policyOverride: { requireUppercase: false, minScore: 0 },
      },
      {
        value: "abcdefghijklm1!",
        className: "vc-password-strength--good",
        policyOverride: { minLength: 8, requireUppercase: false, minScore: 0 },
      },
      { value: "Riverstone-Kettle-2026!", className: "vc-password-strength--strong" },
    ];

    for (const testCase of cases) {
      cleanup();
      render(
        <VaultPasswordField
          value={testCase.value}
          onChange={() => {}}
          policy={{ ...policy, ...testCase.policyOverride }}
        />
      );

      if (testCase.value === "") {
        expect(document.querySelector(`.${testCase.className}`)).toBeNull();
      } else {
        expect(document.querySelector(`.${testCase.className}`)).toBeTruthy();
      }
    }
  });
});

describe("VaultPasswordSetupFields", () => {
  afterEach(() => cleanup());

  it("shows mismatch message for confirmation", () => {
    render(
      <VaultPasswordSetupFields
        password="Riverstone-Kettle-2026!"
        confirmation="different"
        onPasswordChange={() => {}}
        onConfirmationChange={() => {}}
        policy={policy}
      />
    );

    expect(screen.getByText(/Passwords do not match/i)).toBeTruthy();
  });

  it("reports combined validity", () => {
    const onValidityChange = vi.fn();
    render(
      <VaultPasswordSetupFields
        password="Riverstone-Kettle-2026!"
        confirmation="Riverstone-Kettle-2026!"
        onPasswordChange={() => {}}
        onConfirmationChange={() => {}}
        policy={policy}
        onValidityChange={onValidityChange}
      />
    );

    expect(onValidityChange).toHaveBeenCalledWith(true);
  });

  it("forwards confirmation changes", () => {
    const onConfirmationChange = vi.fn();
    render(
      <VaultPasswordSetupFields
        password=""
        confirmation=""
        onPasswordChange={() => {}}
        onConfirmationChange={onConfirmationChange}
        policy={policy}
        passwordLabel="New password"
        confirmationLabel="Confirm new password"
      />
    );

    fireEvent.change(screen.getByLabelText(/Confirm new password/i), {
      target: { value: "Riverstone-Kettle-2026!" },
    });

    expect(onConfirmationChange).toHaveBeenCalledWith("Riverstone-Kettle-2026!");
  });
});
