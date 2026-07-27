import { beforeEach, describe, expect, it, vi } from "vitest";

const matchGate = vi.hoisted(() => ({
  blockedSessionKey: null as CryptoKey | null,
  wait: null as Promise<void> | null,
}));

vi.mock("../../crypto/vault-key-envelope.js", () => ({
  assertInnerVaultKeyBlobMatchesVaultKey: vi.fn(
    async (_inner: Uint8Array, sessionVaultKey: CryptoKey) => {
      if (sessionVaultKey === matchGate.blockedSessionKey && matchGate.wait) {
        await matchGate.wait;
      }
    }
  ),
  extractInnerVaultKeyBlob: vi.fn(),
}));

import {
  beginVaultSessionOperation,
  clearVaultSessionOwner,
} from "../../session/auto-lock.js";
import {
  cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  clearVaultInnerKeyMaterialCache,
  clearVaultInnerKeyMaterialCacheForSessionLock,
  getCachedVaultInnerKeyMaterial,
  resolveInnerVaultKeyBlobForWrap,
} from "../../session/inner-key-material-cache.js";
import {
  resetVaultSessionOperationsForTests,
  VaultSessionOperationCancelledError,
} from "../../session/vault-session-operation.js";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fakeKey(id: string): CryptoKey {
  return { id } as unknown as CryptoKey;
}

describe("inner-key cache operation ownership", () => {
  beforeEach(() => {
    clearVaultSessionOwner();
    clearVaultInnerKeyMaterialCacheForSessionLock();
    resetVaultSessionOperationsForTests();
    matchGate.blockedSessionKey = null;
    matchGate.wait = null;
  });

  it("does not let deferred A cache population overwrite B", async () => {
    const operationA = beginVaultSessionOperation("account-A");
    const keyA = fakeKey("A");
    const gate = deferred();
    matchGate.blockedSessionKey = keyA;
    matchGate.wait = gate.promise;
    const innerA = new Uint8Array([1, 2, 3]);

    const cacheA = cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      innerA,
      fakeKey("wrap-A"),
      keyA,
      { operation: operationA }
    );
    await Promise.resolve();

    const operationB = beginVaultSessionOperation("account-B");
    const innerB = new Uint8Array([4, 5, 6]);
    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      innerB,
      fakeKey("wrap-B"),
      fakeKey("B"),
      { operation: operationB }
    );
    gate.resolve();

    await expect(cacheA).rejects.toBeInstanceOf(VaultSessionOperationCancelledError);
    expect([...innerA]).toEqual([0, 0, 0]);
    expect(getCachedVaultInnerKeyMaterial({ operation: operationB })?.inner).toBe(innerB);
  });

  it("does not let a stale A mismatch path clear B cache", async () => {
    const operationA = beginVaultSessionOperation("account-A");
    const keyA = fakeKey("A");
    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      new Uint8Array([1]),
      fakeKey("wrap-A"),
      keyA,
      { operation: operationA }
    );

    const gate = deferred();
    matchGate.blockedSessionKey = keyA;
    matchGate.wait = gate.promise;
    const resolveA = resolveInnerVaultKeyBlobForWrap(
      keyA,
      undefined,
      { operation: operationA }
    );
    await Promise.resolve();

    const operationB = beginVaultSessionOperation("account-B");
    const innerB = new Uint8Array([9]);
    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      innerB,
      fakeKey("wrap-B"),
      fakeKey("B"),
      { operation: operationB }
    );
    gate.resolve();

    await expect(resolveA).rejects.toBeInstanceOf(VaultSessionOperationCancelledError);
    expect(getCachedVaultInnerKeyMaterial({ operation: operationB })?.inner).toBe(innerB);
  });

  it("requires a current operation for cache reads and mutations after opt-in", async () => {
    beginVaultSessionOperation("account-A");

    expect(() => getCachedVaultInnerKeyMaterial()).toThrow(
      VaultSessionOperationCancelledError
    );
    expect(() => clearVaultInnerKeyMaterialCache()).toThrow(
      VaultSessionOperationCancelledError
    );
    await expect(
      cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
        new Uint8Array([1]),
        fakeKey("wrap"),
        fakeKey("session")
      )
    ).rejects.toBeInstanceOf(VaultSessionOperationCancelledError);
  });
});
