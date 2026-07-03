import { describe, expect, it } from "vitest";
import { normalizeEnvelopeAadContext } from "../../validation/envelope-aad-normalize.js";
import { assertVaultKeyAad } from "../../validation/aad-assert.js";
import type { EncryptedVaultPayload } from "../../validation/schemas.js";
import type { VaultCryptoProfile } from "../../profile.js";

const PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "acme:vault:v1",
  aadContextEnvelope: "acme:vault-envelope:v1",
};

const SCOPE = {
  userId: "00000000-0000-4000-8000-000000000001",
  resourceId: "00000000-0000-4000-8000-000000000001",
};

function basePayload(overrides: Partial<EncryptedVaultPayload["aad"]> = {}): EncryptedVaultPayload {
  return {
    version: "enc-v1",
    alg: "AES-GCM",
    iv: "AAAAAAAAAAAAAAAA",
    ciphertext: "BBBBBBBBBBBBBBBB",
    aad: {
      userId: SCOPE.userId,
      resourceId: SCOPE.resourceId,
      field: "vault_key",
      ...overrides,
    },
  };
}

describe("normalizeEnvelopeAadContext", () => {
  it("injects profile envelope context when context is missing", () => {
    const normalized = normalizeEnvelopeAadContext(basePayload(), PROFILE);
    expect(normalized.aad.context).toBe(PROFILE.aadContextEnvelope);
    expect(() => assertVaultKeyAad(SCOPE, normalized, PROFILE)).not.toThrow();
  });

  it("leaves payloads with explicit context unchanged", () => {
    const payload = basePayload({ context: "legacy:context" });
    expect(normalizeEnvelopeAadContext(payload, PROFILE)).toBe(payload);
    expect(() => assertVaultKeyAad(SCOPE, payload, PROFILE)).toThrow("context mismatch");
  });

  it("does not alter non vault_key fields", () => {
    const payload = basePayload({ field: "vault_payload" });
    expect(normalizeEnvelopeAadContext(payload, PROFILE)).toBe(payload);
  });
});
