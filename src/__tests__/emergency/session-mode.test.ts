import { beforeEach, describe, expect, it } from "vitest";
import {
  clearEmergencyModePin,
  enterVaultEmergencyMode,
  getVaultSessionMode,
  isVaultEmergencyMode,
  lockVaultSession,
  unlockVaultSession,
} from "../../browser.js";
import { createNonExtractableSessionVaultKey } from "../../testing/session-vault-key.js";
import { assertVaultSessionMode } from "../../testing/emergency-session.js";

describe("vault session mode", () => {
  beforeEach(() => {
    lockVaultSession();
    clearEmergencyModePin();
  });

  it("defaults to normal mode", () => {
    expect(getVaultSessionMode()).toBe("normal");
    expect(isVaultEmergencyMode()).toBe(false);
  });

  it("enters emergency mode with decoy unlock role", async () => {
    const key = await createNonExtractableSessionVaultKey();
    await unlockVaultSession(key, { role: "decoy" });
    expect(getVaultSessionMode()).toBe("emergency");
    assertVaultSessionMode("emergency");
  });

  it("keeps emergency pin after lock", async () => {
    enterVaultEmergencyMode();
    const key = await createNonExtractableSessionVaultKey();
    await unlockVaultSession(key, { role: "decoy" });
    lockVaultSession();
    expect(isVaultEmergencyMode()).toBe(true);
  });

  it("clears pin on clearEmergencyModePin", () => {
    enterVaultEmergencyMode();
    clearEmergencyModePin();
    expect(getVaultSessionMode()).toBe("normal");
  });

  it("tracks session key role", async () => {
    const { getSessionKeyRole, isEmergencyModePinned } = await import("../../browser.js");
    const key = await createNonExtractableSessionVaultKey();
    await unlockVaultSession(key, { role: "primary" });
    expect(getSessionKeyRole()).toBe("primary");
    expect(isEmergencyModePinned()).toBe(false);
  });
});
