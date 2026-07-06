import { describe, expect, it } from "vitest";
import { getVaultSessionMode, lockVault } from "../../session/memory-session.js";
import { assertVaultSessionMode } from "../../testing/emergency-session.js";

describe("assertVaultSessionMode", () => {
  it("passes when mode matches", () => {
    lockVault();
    assertVaultSessionMode("normal");
  });

  it("throws when mode mismatches", () => {
    expect(() => assertVaultSessionMode("emergency")).toThrow(/Expected vault session mode/);
    expect(getVaultSessionMode()).toBe("normal");
  });
});
