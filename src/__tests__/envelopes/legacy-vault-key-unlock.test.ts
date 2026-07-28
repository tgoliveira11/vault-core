import { describe, expect, it } from "vitest";
import { createUserVaultKey } from "../../keys/user-vault-key.js";
import { encryptField, decryptField } from "../../crypto/aes-gcm.js";
import {
  isLegacyVaultKeyEnvelope,
  isVaultKeyAadContextAllowed,
  unwrapVaultKeyWithLegacyAadFallback,
  unlockVaultKeyEnvelopeWithAadRouting,
} from "../../envelopes/legacy-vault-key-unlock.js";
import { normalizeEnvelopeAadContext } from "../../validation/envelope-aad-normalize.js";
import type { VaultCryptoProfile } from "../../profile.js";

const PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "acme:vault:v1",
  aadContextEnvelope: "acme:envelope:v1",
  legacyVaultKeyAadContexts: ["acme:legacy-envelope:v0"],
};

const SCOPE = {
  userId: "00000000-0000-4000-8000-000000000001",
  resourceId: "00000000-0000-4000-8000-000000000001",
};

describe("normalizeEnvelopeAadContext", () => {
  it("injects profile context when missing", () => {
    const payload = {
      version: "enc-v1" as const,
      alg: "AES-GCM" as const,
      iv: "a",
      ciphertext: "b",
      aad: { ...SCOPE, field: "vault_key" as const },
    };
    expect(normalizeEnvelopeAadContext(payload, PROFILE).aad.context).toBe(
      PROFILE.aadContextEnvelope
    );
  });

  it("leaves explicit context unchanged", () => {
    const payload = {
      version: "enc-v1" as const,
      alg: "AES-GCM" as const,
      iv: "a",
      ciphertext: "b",
      aad: { ...SCOPE, field: "vault_key" as const, context: "legacy" },
    };
    expect(normalizeEnvelopeAadContext(payload, PROFILE)).toBe(payload);
  });

  it("does not alter non vault_key payloads", () => {
    const payload = {
      version: "enc-v1" as const,
      alg: "AES-GCM" as const,
      iv: "a",
      ciphertext: "b",
      aad: { ...SCOPE, field: "vault_payload" as const },
    };
    expect(normalizeEnvelopeAadContext(payload, PROFILE)).toBe(payload);
  });
});

describe("legacy vault key unlock", () => {
  it("allows only canonical, missing/null, and explicitly allowlisted contexts", () => {
    expect(isVaultKeyAadContextAllowed(PROFILE.aadContextEnvelope, PROFILE)).toBe(true);
    expect(isVaultKeyAadContextAllowed(undefined, PROFILE)).toBe(true);
    expect(isVaultKeyAadContextAllowed(null, PROFILE)).toBe(true);
    expect(isVaultKeyAadContextAllowed("acme:legacy-envelope:v0", PROFILE)).toBe(true);
    expect(isVaultKeyAadContextAllowed("attacker:context", PROFILE)).toBe(false);
    expect(
      isVaultKeyAadContextAllowed(undefined, { ...PROFILE, legacyVaultKeyUnlock: false })
    ).toBe(false);
  });

  it("detects legacy envelopes with missing or mismatched context", () => {
    const missing = {
      version: "enc-v1" as const,
      alg: "AES-GCM" as const,
      iv: "a",
      ciphertext: "b",
      aad: { ...SCOPE, field: "vault_key" as const },
    };
    expect(isLegacyVaultKeyEnvelope(missing, PROFILE)).toBe(true);
    expect(
      isLegacyVaultKeyEnvelope(
        { ...missing, aad: { ...missing.aad, context: PROFILE.aadContextEnvelope } },
        PROFILE
      )
    ).toBe(false);
    expect(isLegacyVaultKeyEnvelope({ ...missing, aad: { ...missing.aad, field: "vault_payload" } }, PROFILE)).toBe(false);
  });

  it("unwraps with legacy AAD fallback", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField("inner", key, { ...SCOPE, field: "vault_key" }, PROFILE);
    const legacyPayload = {
      ...encrypted,
      aad: { ...encrypted.aad, context: undefined },
    };

    const decrypted = await unwrapVaultKeyWithLegacyAadFallback(
      legacyPayload,
      (candidate) => decryptField(candidate, key).then(() => key),
      SCOPE,
      PROFILE
    );
    expect(decrypted).toBe(key);
  });

  it("routes modern envelopes without legacy fallback", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField("inner", key, { ...SCOPE, field: "vault_key" }, PROFILE);
    const routed = await unlockVaultKeyEnvelopeWithAadRouting(
      encrypted,
      SCOPE,
      PROFILE,
      (candidate) => decryptField(candidate, key).then(() => key)
    );
    expect(routed).toBe(key);
  });

  it("skips legacy routing when legacyVaultKeyUnlock is false", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField("inner", key, { ...SCOPE, field: "vault_key" }, PROFILE);
    const legacyPayload = {
      ...encrypted,
      aad: { ...encrypted.aad, context: "old-context" },
    };
    await expect(
      unlockVaultKeyEnvelopeWithAadRouting(
        legacyPayload,
        SCOPE,
        { ...PROFILE, legacyVaultKeyUnlock: false },
        (candidate) => decryptField(candidate, key).then(() => key)
      )
    ).rejects.toThrow("context mismatch");

    const missingContextPayload = {
      ...encrypted,
      aad: { ...encrypted.aad, context: undefined },
    };
    await expect(
      unlockVaultKeyEnvelopeWithAadRouting(
        missingContextPayload,
        SCOPE,
        { ...PROFILE, legacyVaultKeyUnlock: false },
        (candidate) => decryptField(candidate, key).then(() => key)
      )
    ).rejects.toThrow("context mismatch");
  });

  it("throws when legacy fallback cannot decrypt", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField("inner", key, { ...SCOPE, field: "vault_key" }, PROFILE);
    const legacyPayload = {
      ...encrypted,
      aad: { ...encrypted.aad, context: "wrong" },
      ciphertext: encrypted.ciphertext.slice(0, -1) + (encrypted.ciphertext.endsWith("A") ? "B" : "A"),
    };
    await expect(
      unwrapVaultKeyWithLegacyAadFallback(
        legacyPayload,
        (candidate) => decryptField(candidate, key).then(() => key),
        SCOPE,
        PROFILE
      )
    ).rejects.toThrow();
  });

  it("rejects scope mismatches during legacy fallback", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField("inner", key, { ...SCOPE, field: "vault_key" }, PROFILE);
    await expect(
      unwrapVaultKeyWithLegacyAadFallback(
        encrypted,
        (candidate) => decryptField(candidate, key).then(() => key),
        { userId: "11111111-1111-4111-8111-111111111111", resourceId: SCOPE.resourceId },
        PROFILE
      )
    ).rejects.toThrow("userId mismatch");
    await expect(
      unwrapVaultKeyWithLegacyAadFallback(
        encrypted,
        (candidate) => decryptField(candidate, key).then(() => key),
        { userId: SCOPE.userId, resourceId: "22222222-2222-4222-8222-222222222222" },
        PROFILE
      )
    ).rejects.toThrow("resourceId mismatch");
  });

  it("unwraps mismatched legacy context via fallback routing", async () => {
    const key = await createUserVaultKey();
    const encrypted = await encryptField("inner", key, { ...SCOPE, field: "vault_key" }, PROFILE);
    const legacyPayload = {
      ...encrypted,
      aad: { ...encrypted.aad, context: undefined },
    };
    const routed = await unlockVaultKeyEnvelopeWithAadRouting(
      legacyPayload,
      SCOPE,
      PROFILE,
      (candidate) => decryptField(candidate, key).then(() => key)
    );
    expect(routed).toBe(key);
  });

  it("unwraps an explicitly allowlisted legacy context", async () => {
    const key = await createUserVaultKey();
    const legacyPayload = await encryptField(
      "inner",
      key,
      {
        ...SCOPE,
        field: "vault_key",
        context: "acme:legacy-envelope:v0",
      },
      PROFILE
    );

    const routed = await unlockVaultKeyEnvelopeWithAadRouting(
      legacyPayload,
      SCOPE,
      PROFILE,
      (candidate) => decryptField(candidate, key).then(() => key)
    );
    expect(routed).toBe(key);
  });

  it("rejects a valid ciphertext from a non-allowlisted AAD domain", async () => {
    const key = await createUserVaultKey();
    const foreignContextPayload = await encryptField(
      "inner",
      key,
      { ...SCOPE, field: "vault_key", context: "foreign:envelope:v1" },
      PROFILE
    );

    await expect(
      unlockVaultKeyEnvelopeWithAadRouting(
        foreignContextPayload,
        SCOPE,
        PROFILE,
        (candidate) => decryptField(candidate, key).then(() => key)
      )
    ).rejects.toThrow("context mismatch");
  });

  it("preserves null as an authenticated legacy AAD candidate", async () => {
    const key = await createUserVaultKey();
    const nullContextPayload = await encryptField(
      "inner",
      key,
      { ...SCOPE, field: "vault_key", context: null } as unknown as Parameters<
        typeof encryptField
      >[2],
      PROFILE
    );

    const routed = await unlockVaultKeyEnvelopeWithAadRouting(
      nullContextPayload,
      SCOPE,
      PROFILE,
      (candidate) => decryptField(candidate, key).then(() => key)
    );
    expect(routed).toBe(key);
  });
});
