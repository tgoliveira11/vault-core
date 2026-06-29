import { z } from "zod";
import { ENCRYPTION_ALG, ENCRYPTION_VERSION } from "../constants.js";
import { ARGON2ID_LIMITS } from "../kdf/params.js";

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
  version: z.enum(["kdf-v1", "kdf-v2"]),
  salt: z.string().min(1).max(128),
  memory: z.number().int().min(ARGON2ID_LIMITS.memory.min).max(ARGON2ID_LIMITS.memory.max),
  iterations: z.number().int().min(ARGON2ID_LIMITS.iterations.min).max(ARGON2ID_LIMITS.iterations.max),
  parallelism: z.number().int().min(ARGON2ID_LIMITS.parallelism.min).max(ARGON2ID_LIMITS.parallelism.max),
});

export type Argon2idKdfMetadata = z.infer<typeof argon2idKdfMetadataSchema>;

export const kdfMetadataSchema = argon2idKdfMetadataSchema;
export type KdfMetadata = Argon2idKdfMetadata;

export type VaultEnvelopeMethod = "password" | "recovery_phrase" | "passkey_prf";

const envelopeFields = {
  encryptedVaultKey: encryptedPayloadSchema,
  publicMetadata: z.record(z.string(), z.unknown()).optional(),
};

export const passwordEnvelopeSchema = z.object({
  method: z.literal("password"),
  ...envelopeFields,
  kdfMetadata: argon2idKdfMetadataSchema,
});

export const recoveryPhraseEnvelopeSchema = z.object({
  method: z.literal("recovery_phrase"),
  ...envelopeFields,
  kdfMetadata: argon2idKdfMetadataSchema,
});

export const passkeyPrfEnvelopeSchema = z.object({
  method: z.literal("passkey_prf"),
  ...envelopeFields,
  kdfMetadata: z.null(),
});

export const storedEnvelopeSchema = z.discriminatedUnion("method", [
  passwordEnvelopeSchema,
  recoveryPhraseEnvelopeSchema,
  passkeyPrfEnvelopeSchema,
]);

export type VaultEnvelope = z.infer<typeof storedEnvelopeSchema>;
/** @deprecated Use VaultEnvelope */
export type StoredEnvelope = VaultEnvelope;

export type PasswordEnvelope = z.infer<typeof passwordEnvelopeSchema>;
export type RecoveryPhraseEnvelope = z.infer<typeof recoveryPhraseEnvelopeSchema>;
export type PasskeyPrfEnvelope = z.infer<typeof passkeyPrfEnvelopeSchema>;

export { VAULT_CRYPTO_VERSION } from "../constants.js";

export const vaultSetupEnvelopeFieldsSchema = z.object({
  cryptoVersion: z.literal("vault-v1"),
  encryptedBlob: encryptedPayloadSchema,
  passwordEnvelope: passwordEnvelopeSchema,
  recoveryEnvelope: recoveryPhraseEnvelopeSchema,
  passkeyPrfEnvelope: passkeyPrfEnvelopeSchema.nullable().optional(),
});
