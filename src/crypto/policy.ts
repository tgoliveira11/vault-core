import { ENCRYPTION_ALG, ENCRYPTION_VERSION } from "../constants.js";
import {
  LEGACY_ARGON2ID_PARAMS,
  RECOMMENDED_ARGON2ID_PARAMS,
} from "../kdf/params.js";
import type { Argon2idKdfMetadata } from "../validation/schemas.js";

/** Symmetric encryption policy — AES-256-GCM is the current recommended standard. */
export const RECOMMENDED_ENCRYPTION = {
  version: ENCRYPTION_VERSION,
  alg: ENCRYPTION_ALG,
} as const;

/** Legacy KDF label for envelopes created before the kdf-v2 upgrade path. */
export const LEGACY_KDF_VERSION = "kdf-v1" as const;

/** Current KDF label for newly created password/recovery envelopes. */
export const RECOMMENDED_KDF_VERSION = "kdf-v2" as const;

export const RECOMMENDED_KDF_ALGORITHM = "argon2id" as const;

/** Canonical crypto policy consumed by apps, tests, and CI verification. */
export const VAULT_CRYPTO_POLICY = {
  encryption: RECOMMENDED_ENCRYPTION,
  kdf: {
    algorithm: RECOMMENDED_KDF_ALGORITHM,
    version: RECOMMENDED_KDF_VERSION,
    params: RECOMMENDED_ARGON2ID_PARAMS,
  },
  legacyKdf: {
    algorithm: RECOMMENDED_KDF_ALGORITHM,
    version: LEGACY_KDF_VERSION,
    params: LEGACY_ARGON2ID_PARAMS,
  },
} as const;

export function isRecommendedEncryptionPayload(payload: {
  version: string;
  alg: string;
}): boolean {
  return (
    payload.version === RECOMMENDED_ENCRYPTION.version &&
    payload.alg === RECOMMENDED_ENCRYPTION.alg
  );
}

export function isRecommendedArgon2idMetadata(
  metadata: Pick<Argon2idKdfMetadata, "kdf" | "version" | "memory" | "iterations" | "parallelism">
): boolean {
  if (metadata.kdf !== RECOMMENDED_KDF_ALGORITHM) return false;
  if (metadata.version !== RECOMMENDED_KDF_VERSION) return false;
  return (
    metadata.memory === RECOMMENDED_ARGON2ID_PARAMS.memory &&
    metadata.iterations === RECOMMENDED_ARGON2ID_PARAMS.iterations &&
    metadata.parallelism === RECOMMENDED_ARGON2ID_PARAMS.parallelism
  );
}

export function isLegacyArgon2idMetadata(
  metadata: Pick<Argon2idKdfMetadata, "kdf" | "version">
): boolean {
  return metadata.kdf === RECOMMENDED_KDF_ALGORITHM && metadata.version === LEGACY_KDF_VERSION;
}

/** True when an envelope should be re-wrapped with the current recommended KDF on unlock. */
export function isEnvelopeKdfUpgradeRecommended(
  metadata: Argon2idKdfMetadata | null | undefined
): metadata is Argon2idKdfMetadata {
  if (!metadata) return false;
  return !isRecommendedArgon2idMetadata(metadata);
}

export function assertVaultCryptoPolicyIntegrity(): void {
  /* v8 ignore start -- defensive invariants also enforced by CI source scan */
  if (RECOMMENDED_ENCRYPTION.alg !== "AES-GCM") {
    throw new Error("Vault crypto policy requires AES-GCM");
  }
  if (RECOMMENDED_ENCRYPTION.version !== "enc-v1") {
    throw new Error("Vault crypto policy requires enc-v1 payload version");
  }
  if (RECOMMENDED_KDF_ALGORITHM !== "argon2id") {
    throw new Error("Vault crypto policy requires Argon2id");
  }
  if (RECOMMENDED_ARGON2ID_PARAMS.hashLength !== 32) {
    throw new Error("Vault crypto policy requires 256-bit Argon2id output");
  }
  if (
    RECOMMENDED_ARGON2ID_PARAMS.memory < LEGACY_ARGON2ID_PARAMS.memory ||
    RECOMMENDED_ARGON2ID_PARAMS.iterations < LEGACY_ARGON2ID_PARAMS.iterations
  ) {
    throw new Error("Recommended Argon2id params must be at least as strong as legacy params");
  }
  /* v8 ignore stop */
}
