import { beforeEach, describe, expect, it, vi } from "vitest";

const assertionGate = vi.hoisted(() => ({
  blockedKey: null as CryptoKey | null,
  wait: null as Promise<void> | null,
}));

vi.mock("../../keys/user-vault-key.js", () => ({
  assertUserVaultKeyNonExtractable: vi.fn(async (key: CryptoKey) => {
    if (key === assertionGate.blockedKey && assertionGate.wait) {
      await assertionGate.wait;
    }
  }),
}));

import {
  assertVaultSessionOperationCurrent,
  assertVaultSessionLeaseCurrent,
  beginVaultSessionOperation,
  beginVaultSessionUnlock,
  captureVaultSessionLease,
  clearVaultSessionOwner,
  enterVaultEmergencyMode,
  getSessionVaultKey,
  getVaultSessionSnapshot,
  isVaultEmergencyMode,
  isVaultSessionOperationCurrent,
  isVaultSessionLeaseCurrent,
  lockVaultSession,
  registerVaultLockCleanup,
  resetVaultSessionLockState,
  touchVaultSession,
  unlockVaultSession,
  VaultSessionOperationCancelledError,
} from "../../browser.js";
import { resetVaultSessionOperationsForTests } from "../../session/vault-session-operation.js";

function fakeKey(id: string): CryptoKey {
  return { id } as unknown as CryptoKey;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("vault session operation ownership", () => {
  beforeEach(() => {
    assertionGate.blockedKey = null;
    assertionGate.wait = null;
    clearVaultSessionOwner();
    resetVaultSessionOperationsForTests();
    resetVaultSessionLockState();
  });

  it("prevents a deferred A unlock from overwriting a newer B session", async () => {
    const keyA = fakeKey("A");
    const keyB = fakeKey("B");
    const gate = deferred();
    assertionGate.blockedKey = keyA;
    assertionGate.wait = gate.promise;

    const operationA = beginVaultSessionOperation("account-A");
    const unlockA = unlockVaultSession(keyA, { operation: operationA });
    await Promise.resolve();

    const operationB = beginVaultSessionOperation("account-B");
    await unlockVaultSession(keyB, { operation: operationB });
    gate.resolve();

    await expect(unlockA).rejects.toMatchObject({
      code: "vault_session_operation_cancelled",
      reason: "stale_operation",
    });
    expect(getSessionVaultKey()).toBe(keyB);
    expect(isVaultSessionOperationCurrent(operationA)).toBe(false);
    expect(isVaultSessionOperationCurrent(operationB)).toBe(true);
  });

  it("uses last-operation-wins epochs for the same owner", async () => {
    const keyA1 = fakeKey("A-1");
    const keyA2 = fakeKey("A-2");
    const gate = deferred();
    assertionGate.blockedKey = keyA1;
    assertionGate.wait = gate.promise;

    const older = beginVaultSessionOperation("account-A");
    const olderUnlock = unlockVaultSession(keyA1, { operation: older });
    await Promise.resolve();

    const newer = beginVaultSessionOperation("account-A");
    await unlockVaultSession(keyA2, { operation: newer });
    gate.resolve();

    await expect(olderUnlock).rejects.toBeInstanceOf(VaultSessionOperationCancelledError);
    expect(getSessionVaultKey()).toBe(keyA2);
  });

  it("fails closed for unscoped mutations after ownership mode is enabled", async () => {
    beginVaultSessionOperation("account-A");

    await expect(unlockVaultSession(fakeKey("unscoped"))).rejects.toMatchObject({
      reason: "missing_operation",
    });
    expect(() => enterVaultEmergencyMode()).toThrow(
      VaultSessionOperationCancelledError
    );
  });

  it("invalidates operations on lock and clears all owner state on logout", async () => {
    const operation = beginVaultSessionOperation("account-A");
    const key = fakeKey("A");
    const lease = await unlockVaultSession(key, { operation, role: "decoy" });
    expect(lease).not.toBeNull();
    expect(captureVaultSessionLease("account-A")).toBe(lease);
    expect(getVaultSessionSnapshot()).toEqual({
      ownerId: "account-A",
      epoch: lease!.epoch,
      role: "decoy",
    });
    expect(lease).toMatchObject({ ownerId: "account-A", role: "decoy", vaultKey: key });
    expect(isVaultEmergencyMode()).toBe(true);

    lockVaultSession();
    expect(() => assertVaultSessionOperationCurrent(operation)).toThrow(
      VaultSessionOperationCancelledError
    );
    expect(isVaultEmergencyMode()).toBe(true);
    expect(isVaultSessionLeaseCurrent(lease!)).toBe(false);
    expect(getVaultSessionSnapshot()).toBeNull();

    clearVaultSessionOwner();
    expect(getSessionVaultKey()).toBeNull();
    expect(isVaultEmergencyMode()).toBe(false);
  });

  it("validates an owner before clearing an existing session", async () => {
    const operation = beginVaultSessionOperation("account-A");
    const key = fakeKey("A");
    await unlockVaultSession(key, { operation });

    for (const ownerId of [
      "",
      " account-B",
      "x".repeat(2049),
      123 as unknown as string,
    ]) {
      expect(() => beginVaultSessionOperation(ownerId)).toThrow(TypeError);
      expect(getSessionVaultKey()).toBe(key);
      expect(isVaultSessionOperationCurrent(operation)).toBe(true);
    }
  });

  it("preserves legacy single-owner calls until ownership mode is explicitly enabled", async () => {
    const key = fakeKey("legacy");
    await unlockVaultSession(key);
    expect(getSessionVaultKey()).toBe(key);
  });

  it("runs lock cleanup synchronously before issuing a different owner's token", async () => {
    const cleanup = vi.fn();
    const unregister = registerVaultLockCleanup(cleanup);
    const operationA = beginVaultSessionOperation("account-A");
    await unlockVaultSession(fakeKey("A"), { operation: operationA });

    const operationB = beginVaultSessionOperation("account-B");

    expect(cleanup).toHaveBeenCalledOnce();
    expect(getSessionVaultKey()).toBeNull();
    expect(isVaultSessionOperationCurrent(operationB)).toBe(true);
    unregister();
  });

  it("rejects an unissued operation token", () => {
    const forged = {} as Parameters<typeof assertVaultSessionOperationCurrent>[0];
    expect(() => assertVaultSessionOperationCurrent(forged)).toThrow(
      VaultSessionOperationCancelledError
    );
  });

  it("keeps a lease current across a newer same-owner attempt until a new key commits", async () => {
    const attemptA1 = beginVaultSessionUnlock("account-A");
    const leaseA1 = await unlockVaultSession(fakeKey("A-1"), {
      operation: attemptA1,
    });
    expect(leaseA1).not.toBeNull();

    const attemptA2 = beginVaultSessionUnlock("account-A");
    assertVaultSessionLeaseCurrent(leaseA1!);
    touchVaultSession(leaseA1!);

    const leaseA2 = await unlockVaultSession(fakeKey("A-2"), {
      operation: attemptA2,
      role: "primary",
    });
    expect(leaseA2).not.toBe(leaseA1);
    expect(isVaultSessionLeaseCurrent(leaseA1!)).toBe(false);
    expect(isVaultSessionLeaseCurrent(leaseA2!)).toBe(true);
    expect(() => touchVaultSession(leaseA1!)).toThrow(
      VaultSessionOperationCancelledError
    );
    expect(() => captureVaultSessionLease("account-B")).toThrow(
      VaultSessionOperationCancelledError
    );
  });

  it("requires the current lease for post-unlock touch after ownership opt-in", async () => {
    const attempt = beginVaultSessionUnlock("account-A");
    await unlockVaultSession(fakeKey("A"), { operation: attempt });

    expect(() => touchVaultSession()).toThrow(
      VaultSessionOperationCancelledError
    );
  });
});
