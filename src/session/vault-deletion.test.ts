// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPasswordEnvelope,
  createUserVaultKey,
} from "../index.js";
import {
  deleteVaultAfterAuthorization,
  deleteVaultWithPasswordAuthorization,
} from "./vault-deletion.js";
import {
  clearVaultAutoLockTimer,
  getSessionVaultKey,
  isVaultManuallyLocked,
  isVaultUnlocked,
  resetVaultSessionLockState,
  unlockVaultSession,
} from "./auto-lock.js";
import { clearVaultClientState } from "./memory-session.js";
import {
  FIXTURE_ARGON2_SALT,
  FIXTURE_VAULT_PASSWORD,
  LIQSENSE_COMPAT_PROFILE,
  LIQSENSE_COMPAT_SCOPE,
} from "../testing/fixtures/liqsense-compat.js";

describe("vault deletion", () => {
  beforeEach(() => {
    clearVaultClientState();
    resetVaultSessionLockState();
  });

  afterEach(() => {
    clearVaultAutoLockTimer();
    clearVaultClientState();
    resetVaultSessionLockState();
  });

  it("purges persisted vault data and clears session state after authorization", async () => {
    const vaultKey = await createUserVaultKey();
    unlockVaultSession(vaultKey);
    const purge = vi.fn();

    await deleteVaultAfterAuthorization({ purgePersistedVault: purge });

    expect(purge).toHaveBeenCalledOnce();
    expect(isVaultUnlocked()).toBe(false);
    expect(getSessionVaultKey()).toBeNull();
    expect(isVaultManuallyLocked()).toBe(false);
  });

  it("verifies password, purges persistence, and clears session state", async () => {
    const vaultKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    unlockVaultSession(vaultKey);
    const purge = vi.fn();

    await deleteVaultWithPasswordAuthorization({
      currentPassword: FIXTURE_VAULT_PASSWORD,
      passwordEnvelope: envelope,
      scope: LIQSENSE_COMPAT_SCOPE,
      profile: LIQSENSE_COMPAT_PROFILE,
      purgePersistedVault: purge,
    });

    expect(purge).toHaveBeenCalledOnce();
    expect(isVaultUnlocked()).toBe(false);
    expect(isVaultManuallyLocked()).toBe(false);
  });

  it("rejects deletion when the vault password is incorrect", async () => {
    const vaultKey = await createUserVaultKey();
    const { envelope } = await createPasswordEnvelope(
      vaultKey,
      FIXTURE_VAULT_PASSWORD,
      LIQSENSE_COMPAT_SCOPE,
      LIQSENSE_COMPAT_PROFILE,
      FIXTURE_ARGON2_SALT
    );
    unlockVaultSession(vaultKey);
    const purge = vi.fn();

    await expect(
      deleteVaultWithPasswordAuthorization({
        currentPassword: "wrong-password",
        passwordEnvelope: envelope,
        scope: LIQSENSE_COMPAT_SCOPE,
        profile: LIQSENSE_COMPAT_PROFILE,
        purgePersistedVault: purge,
      })
    ).rejects.toThrow();

    expect(purge).not.toHaveBeenCalled();
    expect(isVaultUnlocked()).toBe(true);
  });

  it("awaits async purge callbacks before clearing session state", async () => {
    const order: string[] = [];
    unlockVaultSession(await createUserVaultKey());

    await deleteVaultAfterAuthorization({
      purgePersistedVault: async () => {
        order.push("purge");
      },
    });

    order.push("after");
    expect(order).toEqual(["purge", "after"]);
    expect(isVaultUnlocked()).toBe(false);
  });
});
