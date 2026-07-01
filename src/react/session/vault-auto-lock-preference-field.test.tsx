/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultAutoLockPreferenceField } from "./vault-auto-lock-preference-field.js";

describe("VaultAutoLockPreferenceField", () => {
  afterEach(() => cleanup());

  it("renders slider with admin max and current value", () => {
    render(
      <VaultAutoLockPreferenceField
        value={10}
        onChange={() => {}}
        adminMaxMinutes={30}
        adminDefaultMinutes={15}
      />
    );

    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("30");
    expect(slider.value).toBe("10");
    expect(screen.getByText("10 min")).toBeTruthy();
    expect(screen.getByText(/Organization default: 15 min/)).toBeTruthy();
  });

  it("shows overridden hint when using user preference", () => {
    render(
      <VaultAutoLockPreferenceField
        value={8}
        onChange={() => {}}
        adminMaxMinutes={30}
        adminDefaultMinutes={15}
        usingUserPreference
      />
    );

    expect(screen.getByText(/overridden by your preference/)).toBeTruthy();
  });

  it("calls onChange when the slider moves", () => {
    const onChange = vi.fn();
    render(
      <VaultAutoLockPreferenceField value={5} onChange={onChange} adminMaxMinutes={20} />
    );

    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("disables the slider when requested", () => {
    render(
      <VaultAutoLockPreferenceField value={5} onChange={() => {}} adminMaxMinutes={20} disabled />
    );
    expect(screen.getByRole("slider")).toHaveProperty("disabled", true);
  });
});
