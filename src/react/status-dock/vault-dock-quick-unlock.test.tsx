/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./resolve-passkey-dock-availability.js", () => ({
  resolveVaultDockPasskeyAvailability: vi.fn(() => ({
    hasEnvelope: false,
    showPasskey: false,
    prfExplicitlyUnsupported: false,
  })),
}));

import { resolveVaultDockPasskeyAvailability } from "./resolve-passkey-dock-availability.js";
import { createVaultUnlockRateLimiter } from "../../rate-limit/vault-unlock-rate-limit.js";
import { VaultDockQuickUnlock } from "./vault-dock-quick-unlock.js";

describe("VaultDockQuickUnlock", () => {
  beforeEach(() => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: false,
      showPasskey: false,
      prfExplicitlyUnsupported: false,
    });
  });

  afterEach(() => cleanup());

  it("submits vault password unlock", async () => {
    const onUnlockPassword = vi.fn().mockResolvedValue(undefined);
    render(<VaultDockQuickUnlock onUnlockPassword={onUnlockPassword} />);

    expect(screen.getByRole("button", { name: /unlock vault/i }).className).toContain(
      "vc-status-dock__action--subtle"
    );

    fireEvent.change(screen.getByLabelText(/vault password/i), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unlock vault/i }));

    expect(onUnlockPassword).toHaveBeenCalledWith("secret-password");
  });

  it("submits vault password unlock on Enter", async () => {
    const onUnlockPassword = vi.fn().mockResolvedValue(undefined);
    render(<VaultDockQuickUnlock onUnlockPassword={onUnlockPassword} />);

    const input = screen.getByLabelText(/vault password/i);
    fireEvent.change(input, { target: { value: "secret-password" } });
    fireEvent.submit(input.closest("form")!);

    expect(onUnlockPassword).toHaveBeenCalledWith("secret-password");
  });

  it("auto-focuses vault password input on mount", () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    render(<VaultDockQuickUnlock onUnlockPassword={vi.fn()} />);
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("does not auto-focus password when autoFocusPassword is false", () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    render(
      <VaultDockQuickUnlock onUnlockPassword={vi.fn()} autoFocusPassword={false} />
    );
    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("shows passkey primary unlock when envelope exists", async () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);
    render(
      <VaultDockQuickUnlock
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={onUnlockPasskey}
        passkeyReady
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /unlock with passkey/i }));
    expect(onUnlockPasskey).toHaveBeenCalled();
  });

  it("auto-starts passkey unlock on mount when passkey is primary", async () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);
    render(
      <VaultDockQuickUnlock
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={onUnlockPasskey}
        passkeyReady
      />
    );

    expect(onUnlockPasskey).toHaveBeenCalledTimes(1);
  });

  it("does not auto-start passkey when autoStartPasskey is false", () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);
    render(
      <VaultDockQuickUnlock
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={onUnlockPasskey}
        passkeyReady
        autoStartPasskey={false}
      />
    );

    expect(onUnlockPasskey).not.toHaveBeenCalled();
  });

  it("shows passkey unavailable when envelope exists without callback", () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    render(<VaultDockQuickUnlock onUnlockPassword={vi.fn()} />);
    expect(screen.getByText(/passkey unlock is unavailable/i)).toBeTruthy();
  });

  it("shows rate limit error from unlock limiter", async () => {
    const limiter = createVaultUnlockRateLimiter({
      maxFailures: 0,
      failureWindowMs: 60_000,
      lockoutMs: 60_000,
    });
    render(
      <VaultDockQuickUnlock
        unlockRateLimiter={limiter}
        rateLimitScopeKey="user-1"
        onUnlockPassword={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/vault password/i), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unlock vault/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/too many failed unlock attempts/i);
    });
  });

  it("swallows unlock errors from callbacks", async () => {
    const onUnlockPassword = vi.fn().mockRejectedValue(new Error("bad"));
    render(<VaultDockQuickUnlock onUnlockPassword={onUnlockPassword} error="Shown" />);
    fireEvent.change(screen.getByLabelText(/vault password/i), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unlock vault/i }));
    expect(onUnlockPassword).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("shows passkey unsupported note alongside passkey button", () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: true,
    });
    render(
      <VaultDockQuickUnlock
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={vi.fn()}
        passkeyReady
      />
    );
    expect(screen.getByRole("button", { name: /unlock with passkey/i })).toBeTruthy();
    expect(screen.getByText(/passkey unlock is unavailable/i)).toBeTruthy();
  });

  it("calls passkey failure handler when passkey unlock throws", async () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    const onUnlockPasskey = vi.fn().mockRejectedValue(new Error("bad"));
    const onPasskeyUnlockFailed = vi.fn();
    render(
      <VaultDockQuickUnlock
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={onUnlockPasskey}
        passkeyReady
        autoStartPasskey={false}
        onPasskeyUnlockFailed={onPasskeyUnlockFailed}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /unlock with passkey/i }));
    await waitFor(() => {
      expect(onPasskeyUnlockFailed).toHaveBeenCalled();
    });
  });

  it("uses custom error renderer", () => {
    render(
      <VaultDockQuickUnlock
        onUnlockPassword={vi.fn()}
        error="Custom"
        renderError={(message) => <div data-testid="custom-error">{message}</div>}
      />
    );
    expect(screen.getByTestId("custom-error").textContent).toBe("Custom");
  });

  it("uses custom id prefix for password field", () => {
    render(
      <VaultDockQuickUnlock onUnlockPassword={vi.fn()} idPrefix="custom" />
    );
    expect(screen.getByLabelText(/vault password/i).id).toBe("custom-vault-password");
  });

  it("shows unlocking label while passkey unlock is in progress", () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    render(
      <VaultDockQuickUnlock
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={vi.fn()}
        passkeyReady
        loading
      />
    );
    expect(screen.getByRole("button", { name: /unlocking/i })).toBeTruthy();
  });
});
