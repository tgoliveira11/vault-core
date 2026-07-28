import { describe, expect, it } from "vitest";
import { resolveVaultClientStatus } from "./resolve-vault-client-status.js";

describe("resolveVaultClientStatus", () => {
  it("returns not_setup when vault is not configured", () => {
    expect(resolveVaultClientStatus(null, false, true)).toBe("not_setup");
    expect(resolveVaultClientStatus({ configured: false }, false, true)).toBe("not_setup");
  });

  it("returns unlocked when session is unlocked", () => {
    expect(resolveVaultClientStatus({ configured: true }, true, true)).toBe("unlocked");
  });

  it("returns locked when configured but session locked", () => {
    expect(resolveVaultClientStatus({ configured: true }, false, true)).toBe("locked");
  });

  it("returns unsupported_prf when passkey envelope exists without PRF support", () => {
    expect(
      resolveVaultClientStatus(
        { configured: true, hasPasskeyPrfEnvelope: true },
        false,
        false
      )
    ).toBe("unsupported_prf");
  });

  it("returns emergency_locked when server emergency flag is set", () => {
    expect(
      resolveVaultClientStatus(
        { configured: true, emergencyModeEnabled: true, emergencyModeActive: true },
        false,
        true
      )
    ).toBe("emergency_locked");
  });

  it("returns emergency_unlocked when emergency active and session unlocked", () => {
    expect(
      resolveVaultClientStatus(
        { configured: true, emergencyModeEnabled: true, emergencyModeActive: true },
        true,
        true
      )
    ).toBe("emergency_unlocked");
  });

  it("ignores emergency state unless the feature is explicitly enabled", () => {
    const status = { configured: true, emergencyModeActive: true };
    expect(resolveVaultClientStatus(status, false, true)).toBe("locked");
    expect(resolveVaultClientStatus(status, true, true)).toBe("unlocked");
  });

  it("returns locked copy for emergency_locked expanded state", async () => {
    const { getVaultStatusDockExpandedCopy } = await import(
      "../status-dock/copy.js"
    );
    const copy = getVaultStatusDockExpandedCopy("emergency_locked", null);
    expect(copy.title).toContain("locked");
    const unlockedCopy = getVaultStatusDockExpandedCopy("emergency_unlocked", "1:00");
    expect(unlockedCopy.countdownInline).toContain("1:00");
  });
});
