import { describe, expect, it } from "vitest";
import {
  createPortableVaultBrokerEnrollmentPackage,
  createPortableVaultBrokerUnlockSession,
  isPortableVaultBrokerUnlockResponse,
  serializePortableVaultBrokerEnrollmentPackage,
  unlockPortableVaultBrokerResponse,
  type PortableVaultBrokerEphemeralPublicJwk,
} from "../../browser/portable-vault-broker.js";
import { bytesToBase64Url, toBufferSource } from "../../crypto/encoding.js";
import {
  generatePortableVaultOpaqueAadScope,
  type PortableVaultOpaqueAadScope,
} from "../../crypto/portable-vault-broker-envelope.js";
import { createUserVaultKey, userVaultKeysEqual } from "../../keys/user-vault-key.js";
import { generateUserVaultAesKey } from "../../crypto/user-vault-key-crypto.js";
import type { PortableVaultBrokerSealedPuk } from "../../validation/schemas.js";

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
