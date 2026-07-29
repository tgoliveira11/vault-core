import { beforeEach, describe, expect, it } from "vitest";
import {
  createPortableVaultBrokerEnrollmentPackage,
  createPortableVaultBrokerEnrollmentPackageWithSessionCache,
  createPortableVaultBrokerUnlockSession,
  isPortableVaultBrokerUnlockResponse,
  serializePortableVaultBrokerEnrollmentPackage,
  unlockPortableVaultBrokerResponse,
  type PortableVaultBrokerEphemeralPublicJwk,
} from "../../browser/portable-vault-broker.js";
import {
  createPasswordEnvelope,
  deriveVaultPasswordKeyPairFromMetadata,
  extractInnerVaultKeyBlob,
  unlockWithPasswordEnvelope,
} from "../../index.js";
import { bytesToBase64Url, toBufferSource } from "../../crypto/encoding.js";
import {
  generatePortableVaultOpaqueAadScope,
  type PortableVaultOpaqueAadScope,
} from "../../crypto/portable-vault-broker-envelope.js";
import { createUserVaultKey, userVaultKeysEqual } from "../../keys/user-vault-key.js";
import { generateUserVaultAesKey } from "../../crypto/user-vault-key-crypto.js";
import type { PortableVaultBrokerSealedPuk } from "../../validation/schemas.js";
import {
  cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  clearVaultInnerKeyMaterialCache,
  getCachedVaultInnerKeyMaterial,
} from "../../session/inner-key-material-cache.js";
import { beginVaultSessionOperation } from "../../session/auto-lock.js";
import { resetVaultSessionOperationsForTests } from "../../session/vault-session-operation.js";

const profile = {
  cryptoVersion: "vault-v1",
  aadContextEnvelope: "portable-browser-envelope-v1",
  aadContextVault: "portable-browser-vault-v1",
} as const;

async function sealForBrowser(
  puk: Uint8Array,
  publicJwk: PortableVaultBrokerEphemeralPublicJwk,
  context = "test-context"
): Promise<PortableVaultBrokerSealedPuk> {
  const recipient = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const broker = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: recipient }, broker.privateKey, 256)
  );
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const info = new TextEncoder().encode(`vault-broker:puk-seal:v1:${context}`);
  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      toBufferSource(shared),
      "HKDF",
      false,
      ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: info, tagLength: 128 },
      key,
      puk
    );
    const exported = await crypto.subtle.exportKey("jwk", broker.publicKey);
    return {
      version: "v1",
      algorithm: "ECDH-P256-HKDF-SHA256-A256GCM",
      brokerPublicJwk: {
        kty: "EC",
        crv: "P-256",
        x: exported.x!,
        y: exported.y!,
      },
      salt: bytesToBase64Url(salt),
      iv: bytesToBase64Url(iv),
      ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
      context,
    };
  } finally {
    shared.fill(0);
    salt.fill(0);
    iv.fill(0);
    info.fill(0);
  }
}

async function fixture(scope: PortableVaultOpaqueAadScope = generatePortableVaultOpaqueAadScope()) {
  const vaultKey = await createUserVaultKey();
  const enrollment = await createPortableVaultBrokerEnrollmentPackage({
    vaultKey,
    opaqueScope: scope,
    profile,
  });
  const session = await createPortableVaultBrokerUnlockSession();
  const sealedPuk = await sealForBrowser(enrollment.puk, session.publicJwk);
  const response = {
    encryptedVaultKey: enrollment.encryptedVaultKey,
    sealedPuk,
    requestId: "00000000-0000-4000-8000-000000000001",
    completionReceipt: "signed.receipt.value",
  };
  return { enrollment, response, scope, session, vaultKey };
}

describe("portable vault broker browser client", () => {
  beforeEach(() => {
    resetVaultSessionOperationsForTests();
    clearVaultInnerKeyMaterialCache();
  });

  it("creates a disposable enrollment request without identity fields", async () => {
    const { enrollment } = await fixture();
    const request = serializePortableVaultBrokerEnrollmentPackage(enrollment);
    expect(Object.keys(request)).toEqual(["puk", "encryptedVaultKey"]);
    expect(request.puk).toHaveLength(43);
    enrollment.dispose();
    expect(enrollment.puk).toEqual(new Uint8Array(32));
  });

  it("zeroes the generated PUK when enrollment envelope creation fails", async () => {
    await expect(
      createPortableVaultBrokerEnrollmentPackage({
        vaultKey: await generateUserVaultAesKey(),
        opaqueScope: generatePortableVaultOpaqueAadScope(),
        profile,
      })
    ).rejects.toThrow("Cannot wrap a non-extractable vault key");
  });

  it("creates an RFC 7638-bound one-shot ephemeral session", async () => {
    const session = await createPortableVaultBrokerUnlockSession();
    const canonical = JSON.stringify({
      crv: session.publicJwk.crv,
      kty: session.publicJwk.kty,
      x: session.publicJwk.x,
      y: session.publicJwk.y,
    });
    const expected = bytesToBase64Url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)))
    );
    expect(session.thumbprint).toBe(expected);

    const sealed = await sealForBrowser(new Uint8Array(32).fill(7), session.publicJwk);
    expect(await session.unseal(sealed)).toEqual(new Uint8Array(32).fill(7));
    await expect(session.unseal(sealed)).rejects.toThrow("already been consumed");
  });

  it("unseals a broker response and restores a non-extractable UVK", async () => {
    const { enrollment, response, scope, session, vaultKey } = await fixture();
    const result = await unlockPortableVaultBrokerResponse({
      response,
      session,
      expectedOpaqueScope: scope,
      profile,
    });
    enrollment.dispose();

    expect(result.status).toBe("unlocked");
    if (result.status !== "unlocked") throw new Error("expected unlock");
    expect(result.requestId).toBe(response.requestId);
    expect(result.completionReceipt).toBe(response.completionReceipt);
    expect(result.vaultKey.extractable).toBe(false);
    expect(await userVaultKeysEqual(vaultKey, result.vaultKey)).toBe(true);
    expect(isPortableVaultBrokerUnlockResponse(response)).toBe(true);
  });

  it("enrolls a non-extractable password-unlocked UVK from the owner-scoped memory cache", async () => {
    const scope = generatePortableVaultOpaqueAadScope();
    const originalVaultKey = await createUserVaultKey();
    const passwordEnvelope = await createPasswordEnvelope(
      originalVaultKey,
      "portable cache test password",
      scope,
      profile
    );
    const sessionVaultKey = await unlockWithPasswordEnvelope(
      "portable cache test password",
      passwordEnvelope.envelope,
      scope,
      profile
    );
    const passwordKeys = await deriveVaultPasswordKeyPairFromMetadata(
      "portable cache test password",
      passwordEnvelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      passwordEnvelope.envelope.encryptedVaultKey,
      passwordKeys.encryptionKey
    );
    const operation = beginVaultSessionOperation("portable-cache-owner");
    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      inner,
      passwordKeys.wrappingKey,
      sessionVaultKey,
      { operation }
    );

    const enrollment = await createPortableVaultBrokerEnrollmentPackageWithSessionCache({
      vaultKey: sessionVaultKey,
      opaqueScope: scope,
      profile,
      operation,
    });
    const unlockSession = await createPortableVaultBrokerUnlockSession();
    const response = {
      encryptedVaultKey: enrollment.encryptedVaultKey,
      sealedPuk: await sealForBrowser(enrollment.puk, unlockSession.publicJwk),
      requestId: "00000000-0000-4000-8000-000000000002",
      completionReceipt: "signed.receipt.value",
    };
    enrollment.dispose();
    clearVaultInnerKeyMaterialCache({ operation });

    const result = await unlockPortableVaultBrokerResponse({
      response,
      session: unlockSession,
      expectedOpaqueScope: scope,
      profile,
      operation,
      verifyAndConsumeCompletionReceipt: async (receipt) => {
        expect(receipt).toBe(response.completionReceipt);
        expect(getCachedVaultInnerKeyMaterial({ operation })).toBeNull();
      },
    });
    expect(result.status).toBe("unlocked");
    if (result.status !== "unlocked") throw new Error("expected unlock");
    expect(result.vaultKey.extractable).toBe(false);
    expect(await userVaultKeysEqual(originalVaultKey, result.vaultKey)).toBe(true);
    expect(getCachedVaultInnerKeyMaterial({ operation })).not.toBeNull();
  });

  it("uses the fresh-key path when no session cache exists", async () => {
    const enrollment = await createPortableVaultBrokerEnrollmentPackageWithSessionCache({
      vaultKey: await createUserVaultKey(),
      opaqueScope: generatePortableVaultOpaqueAadScope(),
      profile,
    });
    expect(enrollment.puk).toHaveLength(32);
    enrollment.dispose();
  });

  it("disposes a fresh-key enrollment if its owner operation becomes stale", async () => {
    const operation = beginVaultSessionOperation("portable-owner-A");
    const pending = createPortableVaultBrokerEnrollmentPackageWithSessionCache({
      vaultKey: await createUserVaultKey(),
      opaqueScope: generatePortableVaultOpaqueAadScope(),
      profile,
      operation,
    });
    beginVaultSessionOperation("portable-owner-B");
    await expect(pending).rejects.toThrow("cancelled");
  });

  it("clears a mismatched cached key instead of wrapping a different session UVK", async () => {
    const scope = generatePortableVaultOpaqueAadScope();
    const cachedVaultKey = await createUserVaultKey();
    const passwordEnvelope = await createPasswordEnvelope(
      cachedVaultKey,
      "portable mismatch test password",
      scope,
      profile
    );
    const passwordKeys = await deriveVaultPasswordKeyPairFromMetadata(
      "portable mismatch test password",
      passwordEnvelope.kdfMetadata
    );
    const inner = await extractInnerVaultKeyBlob(
      passwordEnvelope.envelope.encryptedVaultKey,
      passwordKeys.encryptionKey
    );
    const operation = beginVaultSessionOperation("portable-mismatch-owner");
    await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
      inner,
      passwordKeys.wrappingKey,
      cachedVaultKey,
      { operation }
    );

    await expect(
      createPortableVaultBrokerEnrollmentPackageWithSessionCache({
        vaultKey: await createUserVaultKey(),
        opaqueScope: scope,
        profile,
        operation,
      })
    ).rejects.toThrow("does not match the current session");
    expect(getCachedVaultInnerKeyMaterial({ operation })).toBeNull();
  });

  it("repopulates the memory cache after portable unlock for later enrollment", async () => {
    const first = await fixture();
    const operation = beginVaultSessionOperation("portable-unlock-owner");
    const unlocked = await unlockPortableVaultBrokerResponse({
      response: first.response,
      session: first.session,
      expectedOpaqueScope: first.scope,
      profile,
      operation,
      verifyAndConsumeCompletionReceipt: async () => undefined,
    });
    first.enrollment.dispose();
    expect(unlocked.status).toBe("unlocked");
    if (unlocked.status !== "unlocked") throw new Error("expected unlock");

    const second = await createPortableVaultBrokerEnrollmentPackageWithSessionCache({
      vaultKey: unlocked.vaultKey,
      opaqueScope: first.scope,
      profile,
      operation,
    });
    expect(second.encryptedVaultKey.aad).toEqual(first.enrollment.encryptedVaultKey.aad);
    second.dispose();
  });

  it("does not populate the memory cache when completion receipt verification fails", async () => {
    const first = await fixture();
    const operation = beginVaultSessionOperation("portable-rejected-receipt-owner");
    const result = await unlockPortableVaultBrokerResponse({
      response: first.response,
      session: first.session,
      expectedOpaqueScope: first.scope,
      profile,
      operation,
      verifyAndConsumeCompletionReceipt: async () => {
        expect(getCachedVaultInnerKeyMaterial({ operation })).toBeNull();
        throw new Error("receipt rejected");
      },
    });
    first.enrollment.dispose();

    expect(result).toMatchObject({ status: "completion_receipt_rejected" });
    expect(getCachedVaultInnerKeyMaterial({ operation })).toBeNull();
  });

  it("requires receipt verification before an owner-scoped portable unlock", async () => {
    const first = await fixture();
    const operation = beginVaultSessionOperation("portable-missing-receipt-verifier");
    await expect(
      unlockPortableVaultBrokerResponse({
        response: first.response,
        session: first.session,
        expectedOpaqueScope: first.scope,
        profile,
        operation,
      } as never)
    ).rejects.toThrow("completion receipt verifier is required");
    first.enrollment.dispose();
  });

  it("returns typed malformed, seal, and envelope failures", async () => {
    const malformed = await fixture();
    expect(
      await unlockPortableVaultBrokerResponse({
        response: { nope: true },
        session: malformed.session,
        expectedOpaqueScope: malformed.scope,
        profile,
      })
    ).toMatchObject({ status: "malformed_response" });
    expect(isPortableVaultBrokerUnlockResponse({ nope: true })).toBe(false);

    const tampered = await fixture();
    tampered.response.sealedPuk.ciphertext = bytesToBase64Url(new Uint8Array(48));
    expect(
      await unlockPortableVaultBrokerResponse({
        response: tampered.response,
        session: tampered.session,
        expectedOpaqueScope: tampered.scope,
        profile,
      })
    ).toMatchObject({ status: "puk_unseal_failed" });

    const wrongScope = await fixture();
    expect(
      await unlockPortableVaultBrokerResponse({
        response: wrongScope.response,
        session: wrongScope.session,
        expectedOpaqueScope: { ...wrongScope.scope, resourceId: crypto.randomUUID() },
        profile,
      })
    ).toMatchObject({ status: "vault_key_unwrap_failed" });
  });

  it("fails closed on malformed sealed lengths, explicit disposal, and malformed enrollment", async () => {
    const session = await createPortableVaultBrokerUnlockSession();
    const sealed = await sealForBrowser(new Uint8Array(32), session.publicJwk);
    sealed.salt = bytesToBase64Url(new Uint8Array(31));
    await expect(session.unseal(sealed)).rejects.toThrow("invalid field lengths");

    const disposed = await createPortableVaultBrokerUnlockSession();
    disposed.dispose();
    await expect(disposed.unseal(await sealForBrowser(new Uint8Array(32), disposed.publicJwk)))
      .rejects.toThrow("already been consumed");

    expect(() =>
      serializePortableVaultBrokerEnrollmentPackage({
        puk: new Uint8Array(31),
        encryptedVaultKey: {} as never,
      })
    ).toThrow("exactly 32 bytes");
  });
});
