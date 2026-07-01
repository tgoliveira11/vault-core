import { describe, expect, it, vi } from "vitest";

vi.mock("../../browser.js", () => ({
  isPrfExtensionSupported: vi.fn(() => true),
}));

import { isPrfExtensionSupported } from "../../browser.js";
import { resolveVaultDockPasskeyAvailability } from "./resolve-passkey-dock-availability.js";

describe("resolveVaultDockPasskeyAvailability", () => {
  it("returns no envelope when passkey PRF is not configured", () => {
    expect(resolveVaultDockPasskeyAvailability({ configured: true })).toEqual({
      hasEnvelope: false,
      showPasskey: false,
      prfExplicitlyUnsupported: false,
    });
  });

  it("hides passkey when PRF is unsupported in the browser", () => {
    vi.mocked(isPrfExtensionSupported).mockReturnValue(false);
    expect(
      resolveVaultDockPasskeyAvailability({
        configured: true,
        hasPasskeyPrfEnvelope: true,
      })
    ).toEqual({
      hasEnvelope: true,
      showPasskey: false,
      prfExplicitlyUnsupported: true,
    });
  });

  it("shows passkey when envelope exists and PRF is supported", () => {
    vi.mocked(isPrfExtensionSupported).mockReturnValue(true);
    expect(
      resolveVaultDockPasskeyAvailability({
        configured: true,
        hasPasskeyPrfEnvelope: true,
      })
    ).toEqual({
      hasEnvelope: true,
      showPasskey: true,
      prfExplicitlyUnsupported: false,
    });
  });
});
