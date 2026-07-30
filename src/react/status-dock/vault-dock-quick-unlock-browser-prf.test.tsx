/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VaultServerStatusSnapshot } from "../status/resolve-vault-client-status.js";
import { VaultDockQuickUnlock } from "./vault-dock-quick-unlock.js";

// No module mocks here: this exercises the real availability resolver in a jsdom browser without
// `PublicKeyCredential`, where the PRF heuristic reports unavailable.
const BOUND_PASSKEY_STATUS: VaultServerStatusSnapshot = {
  configured: true,
  hasPasskeyPrfEnvelope: true,
  passkeyUnlockAvailableOnThisBrowser: true,
};

describe("VaultDockQuickUnlock passkeyUnlockRequiresBrowserPrf", () => {
  afterEach(() => cleanup());

  it("hides the passkey button without PRF support by default", () => {
    expect(globalThis.PublicKeyCredential).toBeUndefined();

    render(
      <VaultDockQuickUnlock
        serverStatus={BOUND_PASSKEY_STATUS}
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /unlock with passkey/i })).toBeNull();
    expect(screen.getByText(/passkey unlock is unavailable in this browser/i)).toBeTruthy();
  });

  it("renders the passkey button without PRF support when browser PRF is not required", () => {
    expect(globalThis.PublicKeyCredential).toBeUndefined();

    render(
      <VaultDockQuickUnlock
        serverStatus={{ ...BOUND_PASSKEY_STATUS, passkeyUnlockRequiresBrowserPrf: false }}
        onUnlockPassword={vi.fn()}
        onUnlockPasskey={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /unlock with passkey/i })).toBeTruthy();
    expect(screen.queryByText(/passkey unlock is unavailable in this browser/i)).toBeNull();
  });
});
