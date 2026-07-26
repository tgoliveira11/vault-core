import { describe, expect, it, vi } from "vitest";

vi.mock("../../browser.js", () => ({
  isPrfExtensionHeuristicallyAvailable: vi.fn(() => true),
}));

import { isPrfExtensionHeuristicallyAvailable } from "../../browser.js";
import { resolveVaultDockPasskeyAvailability } from "./resolve-passkey-dock-availability.js";

describe("resolveVaultDockPasskeyAvailability", () => {
  it("returns no envelope when passkey PRF is not configured", () => {
    expect(resolveVaultDockPasskeyAvailability({ configured: true })).toEqual({
      hasEnvelope: false,
      showPasskey: false,
      prfExplicitlyUnsupported: false,
    });
  });

  it("hides passkey when device binding is inactive on this browser", () => {
    vi.mocked(isPrfExtensionHeuristicallyAvailable).mockReturnValue(true);
    expect(
      resolveVaultDockPasskeyAvailability({
        configured: true,
        hasPasskeyPrfEnvelope: true,
        passkeyUnlockAvailableOnThisDevice: false,
      })
    ).toEqual({
      hasEnvelope: true,
      showPasskey: false,
      prfExplicitlyUnsupported: false,
    });
  });

  it("hides passkey when PRF is unsupported in the browser", () => {
    vi.mocked(isPrfExtensionHeuristicallyAvailable).mockReturnValue(false);
    expect(
      resolveVaultDockPasskeyAvailability({
        configured: true,
        hasPasskeyPrfEnvelope: true,
        passkeyUnlockAvailableOnThisBrowser: true,
      })
    ).toEqual({
      hasEnvelope: true,
      showPasskey: false,
      prfExplicitlyUnsupported: true,
    });
  });

  it("shows passkey when envelope exists and PRF is supported", () => {
    vi.mocked(isPrfExtensionHeuristicallyAvailable).mockReturnValue(true);
    expect(
      resolveVaultDockPasskeyAvailability({
        configured: true,
        hasPasskeyPrfEnvelope: true,
        passkeyUnlockAvailableOnThisBrowser: true,
      })
    ).toEqual({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
  });

  it("shows passkey when device binding is active", () => {
    vi.mocked(isPrfExtensionHeuristicallyAvailable).mockReturnValue(true);
    expect(
      resolveVaultDockPasskeyAvailability({
        configured: true,
        hasPasskeyPrfEnvelope: true,
        passkeyUnlockAvailableOnThisDevice: true,
      })
    ).toEqual({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
  });
});
