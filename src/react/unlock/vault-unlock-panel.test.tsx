/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../status-dock/resolve-passkey-dock-availability.js", () => ({
  resolveVaultDockPasskeyAvailability: vi.fn(() => ({
    hasEnvelope: false,
    showPasskey: false,
    prfExplicitlyUnsupported: false,
  })),
}));

import { resolveVaultDockPasskeyAvailability } from "../status-dock/resolve-passkey-dock-availability.js";
import { VaultUnlockPanel } from "./vault-unlock-panel.js";

describe("VaultUnlockPanel", () => {
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
    render(
      <VaultUnlockPanel
        onUnlockPassword={onUnlockPassword}
        onUnlockRecoveryPhrase={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/vault password/i), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unlock vault/i }));

    await waitFor(() => {
      expect(onUnlockPassword).toHaveBeenCalledWith("secret-password");
    });
  });

  it("submits recovery phrase unlock from the recovery tab", async () => {
    const onUnlockRecoveryPhrase = vi.fn().mockResolvedValue(undefined);
    render(
      <VaultUnlockPanel
        onUnlockPassword={vi.fn()}
        onUnlockRecoveryPhrase={onUnlockRecoveryPhrase}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: /recovery phrase/i }));
    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: "alpha beta gamma" },
    });
    fireEvent.click(screen.getByRole("button", { name: /recover vault access/i }));

    await waitFor(() => {
      expect(onUnlockRecoveryPhrase).toHaveBeenCalledWith("alpha beta gamma");
    });
  });

  it("shows passkey unlock when envelope exists", async () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);
    render(
      <VaultUnlockPanel
        onUnlockPassword={vi.fn()}
        onUnlockRecoveryPhrase={vi.fn()}
        onUnlockPasskey={onUnlockPasskey}
        passkeyReady
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /unlock with passkey/i }));

    await waitFor(() => {
      expect(onUnlockPasskey).toHaveBeenCalled();
    });
  });

  it("renders unlock error", () => {
    render(
      <VaultUnlockPanel
        error="Unlock failed"
        onUnlockPassword={vi.fn()}
        onUnlockRecoveryPhrase={vi.fn()}
      />
    );

    expect(screen.getByRole("alert").textContent).toContain("Unlock failed");
  });

  it("auto-starts passkey unlock on mount when configured", async () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
    const onUnlockPasskey = vi.fn().mockResolvedValue(undefined);
    render(
      <VaultUnlockPanel
        onUnlockPassword={vi.fn()}
        onUnlockRecoveryPhrase={vi.fn()}
        onUnlockPasskey={onUnlockPasskey}
        passkeyReady
        autoStartPasskey
      />
    );

    await waitFor(() => {
      expect(onUnlockPasskey).toHaveBeenCalledTimes(1);
    });
  });

  it("auto-focuses vault password when passkey is not primary", () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    render(
      <VaultUnlockPanel onUnlockPassword={vi.fn()} onUnlockRecoveryPhrase={vi.fn()} />
    );
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("switches back to password tab", () => {
    render(
      <VaultUnlockPanel onUnlockPassword={vi.fn()} onUnlockRecoveryPhrase={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("tab", { name: /recovery phrase/i }));
    fireEvent.click(screen.getByRole("tab", { name: /vault password/i }));

    expect(screen.getByLabelText(/vault password/i)).toBeTruthy();
  });

  it("shows passkey unavailable note when PRF is unsupported", () => {
    vi.mocked(resolveVaultDockPasskeyAvailability).mockReturnValue({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: true,
    });
    render(
      <VaultUnlockPanel
        onUnlockPassword={vi.fn()}
        onUnlockRecoveryPhrase={vi.fn()}
        onUnlockPasskey={vi.fn()}
        passkeyReady
      />
    );

    expect(screen.getByText(/passkey unlock is unavailable/i)).toBeTruthy();
  });

  it("submits vault password unlock on Enter", async () => {
    const onUnlockPassword = vi.fn().mockResolvedValue(undefined);
    render(
      <VaultUnlockPanel
        onUnlockPassword={onUnlockPassword}
        onUnlockRecoveryPhrase={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/vault password/i);
    fireEvent.change(input, { target: { value: "secret-password" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(onUnlockPassword).toHaveBeenCalledWith("secret-password");
    });
  });

  it("swallows unlock errors from callbacks", async () => {
    const onUnlockPassword = vi.fn().mockRejectedValue(new Error("bad"));
    render(
      <VaultUnlockPanel
        error="Shown"
        onUnlockPassword={onUnlockPassword}
        onUnlockRecoveryPhrase={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/vault password/i), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unlock vault/i }));
    await waitFor(() => {
      expect(onUnlockPassword).toHaveBeenCalled();
    });
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
