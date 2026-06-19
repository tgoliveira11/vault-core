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
});
