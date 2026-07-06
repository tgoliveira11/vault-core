import { describe, expect, it } from "vitest";
import {
  vaultDecoyRecordSchema,
  vaultSetupEnvelopeFieldsSchema,
  vaultSetupWithDecoySchema,
  vaultEmergencyServerMetadataSchema,
} from "../../validation/schemas.js";

const validEncryptedBlob = {
  version: "enc-v1" as const,
  alg: "AES-GCM" as const,
  iv: "iv",
  ciphertext: "ct",
  aad: {
    userId: "00000000-0000-4000-8000-000000000001",
    resourceId: "00000000-0000-4000-8000-000000000002",
    field: "vault_payload" as const,
  },
};

const validEnvelope = {
  method: "password" as const,
  encryptedVaultKey: {
    ...validEncryptedBlob,
    aad: { ...validEncryptedBlob.aad, field: "vault_key" as const },
  },
  kdfMetadata: {
    kdf: "argon2id" as const,
    version: "kdf-v2" as const,
    salt: "c2FsdA",
    memory: 65536,
    iterations: 3,
    parallelism: 1,
  },
};

const validRecoveryEnvelope = {
  method: "recovery_phrase" as const,
  encryptedVaultKey: {
    ...validEncryptedBlob,
    aad: { ...validEncryptedBlob.aad, field: "vault_key" as const },
  },
  kdfMetadata: validEnvelope.kdfMetadata,
};

describe("decoy vault schemas", () => {
  it("parses primary-only records (backward compatible)", () => {
    const result = vaultSetupEnvelopeFieldsSchema.safeParse({
      cryptoVersion: "vault-v1",
      encryptedBlob: validEncryptedBlob,
      passwordEnvelope: validEnvelope,
      recoveryEnvelope: validRecoveryEnvelope,
    });
    expect(result.success).toBe(true);
  });

  it("parses vault setup with optional decoy", () => {
    const decoy = {
      cryptoVersion: "vault-v1",
      encryptedBlob: validEncryptedBlob,
      passwordEnvelope: validEnvelope,
      recoveryEnvelope: validRecoveryEnvelope,
      passkeyPrfEnvelope: null,
    };
    const result = vaultSetupWithDecoySchema.safeParse({
      cryptoVersion: "vault-v1",
      encryptedBlob: validEncryptedBlob,
      passwordEnvelope: validEnvelope,
      recoveryEnvelope: validRecoveryEnvelope,
      decoy,
    });
    expect(result.success).toBe(true);
  });

  it("rejects tampered decoy crypto version", () => {
    const result = vaultDecoyRecordSchema.safeParse({
      cryptoVersion: "vault-v0",
      encryptedBlob: validEncryptedBlob,
      passwordEnvelope: validEnvelope,
      recoveryEnvelope: validRecoveryEnvelope,
    });
    expect(result.success).toBe(false);
  });

  it("parses emergency server metadata", () => {
    const result = vaultEmergencyServerMetadataSchema.safeParse({
      emergencyModeActive: true,
      decoyConfigured: true,
      duressSequence: "911",
    });
    expect(result.success).toBe(true);
  });
});
