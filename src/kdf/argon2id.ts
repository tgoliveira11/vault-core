import { argon2id } from "hash-wasm";
import type { Argon2idKdfMetadata } from "../validation/schemas.js";
import {
  bytesToBase64Url,
  base64UrlToBytes,
  toBufferSource,
  stringToBytes,
} from "../crypto/encoding.js";
import {
  assertSafeArgon2idParams,
  assertSafeArgon2idSalt,
  DEFAULT_ARGON2ID_PARAMS,
} from "./params.js";

export { DEFAULT_ARGON2ID_PARAMS, type Argon2idParams } from "./params.js";

export type { Argon2idKdfMetadata };

export function serializeArgon2idMetadata(
  salt: Uint8Array,
  params: Pick<typeof DEFAULT_ARGON2ID_PARAMS, "memory" | "iterations" | "parallelism"> = DEFAULT_ARGON2ID_PARAMS
): Argon2idKdfMetadata {
  assertSafeArgon2idSalt(salt);
  assertSafeArgon2idParams(params);
  return {
    kdf: "argon2id",
    version: "kdf-v1",
    salt: bytesToBase64Url(salt),
    memory: params.memory,
    iterations: params.iterations,
    parallelism: params.parallelism,
  };
}

export function parseArgon2idMetadata(metadata: Argon2idKdfMetadata): {
  salt: Uint8Array;
  memory: number;
  iterations: number;
  parallelism: number;
} {
  if (metadata.salt.length > 128) {
    throw new Error("Argon2id salt encoding is too large");
  }
  assertSafeArgon2idParams(metadata);
  const salt = base64UrlToBytes(metadata.salt);
  assertSafeArgon2idSalt(salt);
  return {
    salt,
    memory: metadata.memory,
    iterations: metadata.iterations,
    parallelism: metadata.parallelism,
  };
}

export async function deriveArgon2idAesKey(
  passwordBytes: Uint8Array,
  salt: Uint8Array,
  params: {
    memory: number;
    iterations: number;
    parallelism: number;
    hashLength?: number;
  } = DEFAULT_ARGON2ID_PARAMS
): Promise<CryptoKey> {
  assertSafeArgon2idParams(params);
  assertSafeArgon2idSalt(salt);
  const hashLength = params.hashLength ?? DEFAULT_ARGON2ID_PARAMS.hashLength;
  if (hashLength !== DEFAULT_ARGON2ID_PARAMS.hashLength) {
    throw new Error(`Argon2id hash length must be ${DEFAULT_ARGON2ID_PARAMS.hashLength} bytes`);
  }
  const hash = await argon2id({
    password: passwordBytes,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memory,
    hashLength,
    outputType: "binary",
  });

  return crypto.subtle.importKey(
    "raw",
    toBufferSource(new Uint8Array(hash)),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function deriveArgon2idAesKeyFromMetadata(
  passwordBytes: Uint8Array,
  metadata: Argon2idKdfMetadata
): Promise<CryptoKey> {
  const { salt, memory, iterations, parallelism } = parseArgon2idMetadata(metadata);
  return deriveArgon2idAesKey(passwordBytes, salt, {
    memory,
    iterations,
    parallelism,
    hashLength: DEFAULT_ARGON2ID_PARAMS.hashLength,
  });
}

export async function deriveVaultPasswordKey(
  vaultPassword: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; metadata: Argon2idKdfMetadata }> {
  const saltBytes =
    salt ?? crypto.getRandomValues(new Uint8Array(DEFAULT_ARGON2ID_PARAMS.saltLength));
  const passwordBytes = stringToBytes(vaultPassword.normalize("NFKC"));
  const key = await deriveArgon2idAesKey(passwordBytes, saltBytes);
  return {
    key,
    metadata: serializeArgon2idMetadata(saltBytes),
  };
}

export async function deriveVaultPasswordKeyFromMetadata(
  vaultPassword: string,
  metadata: Argon2idKdfMetadata
): Promise<CryptoKey> {
  return deriveArgon2idAesKeyFromMetadata(
    stringToBytes(vaultPassword.normalize("NFKC")),
    metadata
  );
}
