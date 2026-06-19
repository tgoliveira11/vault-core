import { z } from "zod";
import { ENCRYPTION_ALG, ENCRYPTION_VERSION } from "../constants.js";

const aadFieldSchema = z.enum(["vault_key", "vault_payload", "vault_index"]);

export const encryptedPayloadSchema = z.object({
  version: z.literal(ENCRYPTION_VERSION),
  alg: z.literal(ENCRYPTION_ALG),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
  aad: z.object({
    userId: z.string().uuid(),
    resourceId: z.string().uuid(),
    field: aadFieldSchema,
    context: z.string().optional(),
  }),
});

export type EncryptedVaultPayload = z.infer<typeof encryptedPayloadSchema>;
/** @deprecated Use EncryptedVaultPayload */
export type EncryptedPayload = EncryptedVaultPayload;

export const argon2idKdfMetadataSchema = z.object({
  kdf: z.literal("argon2id"),
  version: z.literal("kdf-v1"),
  salt: z.string().min(1),
  memory: z.number().int().positive(),
  iterations: z.number().int().positive(),
  parallelism: z.number().int().positive(),
});

export type Argon2idKdfMetadata = z.infer<typeof argon2idKdfMetadataSchema>;

export const kdfMetadataSchema = argon2idKdfMetadataSchema;
export type KdfMetadata = Argon2idKdfMetadata;

export type VaultEnvelopeMethod = "password" | "recovery_phrase" | "passkey_prf";

export const storedEnvelopeSchema = z.object({
  method: z.enum(["password", "recovery_phrase", "passkey_prf"]),
  encryptedVaultKey: encryptedPayloadSchema,
  kdfMetadata: kdfMetadataSchema.nullable(),
  publicMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type VaultEnvelope = z.infer<typeof storedEnvelopeSchema>;
/** @deprecated Use VaultEnvelope */
export type StoredEnvelope = VaultEnvelope;

export type PasswordEnvelope = VaultEnvelope & {
  method: "password";
  kdfMetadata: Argon2idKdfMetadata;
};

export type RecoveryPhraseEnvelope = VaultEnvelope & {
  method: "recovery_phrase";
  kdfMetadata: Argon2idKdfMetadata;
};

export type PasskeyPrfEnvelope = VaultEnvelope & {
  method: "passkey_prf";
  kdfMetadata: null;
};

export { VAULT_CRYPTO_VERSION } from "../constants.js";

export const vaultSetupEnvelopeFieldsSchema = z.object({
  cryptoVersion: z.literal("vault-v1"),
  encryptedBlob: encryptedPayloadSchema,
  passwordEnvelope: storedEnvelopeSchema,
  recoveryEnvelope: storedEnvelopeSchema,
  passkeyPrfEnvelope: storedEnvelopeSchema.nullable().optional(),
});
