import { z } from "zod";
import {
  createPortableVaultBrokerEncryptedVaultKeyFromCachedMaterial,
  createPortableVaultBrokerEncryptedVaultKey,
  generatePortableVaultUnlockKey,
  unlockPortableVaultBrokerEncryptedVaultKey,
  unlockPortableVaultBrokerEncryptedVaultKeyWithInnerMaterial,
  type CreatePortableVaultBrokerEnvelopeOptions,
  type PortableVaultOpaqueAadScope,
} from "../crypto/portable-vault-broker-envelope.js";
import { bytesToBase64Url, decodeBoundedBase64Url, toBufferSource } from "../crypto/encoding.js";
import type { VaultCryptoProfile } from "../profile.js";
import {
  encryptedPayloadSchema,
  portableVaultBrokerUnlockResponseSchema,
  type EncryptedVaultPayload,
  type PortableVaultBrokerUnlockResponse,
  type PortableVaultBrokerSealedPuk,
} from "../validation/schemas.js";
import { VaultAuthorizationError } from "../errors/vault-errors.js";
import {
  cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  clearVaultInnerKeyMaterialCache,
  getCachedVaultInnerKeyMaterial,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
} from "../session/inner-key-material-cache.js";
import {
  assertVaultSessionMutationAllowed,
  type VaultSessionOperation,
} from "../session/vault-session-operation.js";

const PUK_BYTES = 32;
const ECDH_SALT_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const SEALED_PUK_BYTES = PUK_BYTES + 16;

export type PortableVaultBrokerEnrollmentPackage = {
  /** Must be sent only to the trusted broker over TLS, then zeroed with `dispose()`. */
  puk: Uint8Array;
  encryptedVaultKey: EncryptedVaultPayload;
  dispose: () => void;
};

export async function createPortableVaultBrokerEnrollmentPackage(input: {
  vaultKey: CryptoKey;
  opaqueScope: PortableVaultOpaqueAadScope;
  profile: VaultCryptoProfile;
  options?: CreatePortableVaultBrokerEnvelopeOptions;
}): Promise<PortableVaultBrokerEnrollmentPackage> {
  const puk = generatePortableVaultUnlockKey();
  try {
    const encryptedVaultKey = await createPortableVaultBrokerEncryptedVaultKey(
      input.vaultKey,
      puk,
      input.opaqueScope,
      input.profile,
      input.options
    );
    return {
      puk,
      encryptedVaultKey,
      dispose: () => puk.fill(0),
    };
  } catch (error) {
    puk.fill(0);
    throw error;
  }
}

/**
 * Creates a portable enrollment package from a non-extractable session UVK by re-wrapping the
 * memory-only inner-key cache directly to the fresh PUK-derived wrapping key.
 */
export async function createPortableVaultBrokerEnrollmentPackageWithSessionCache(input: {
  vaultKey: CryptoKey;
  opaqueScope: PortableVaultOpaqueAadScope;
  profile: VaultCryptoProfile;
  operation?: VaultSessionOperation;
}): Promise<PortableVaultBrokerEnrollmentPackage> {
  assertVaultSessionMutationAllowed(input.operation);
  const sessionOptions = { operation: input.operation };
  const cached = getCachedVaultInnerKeyMaterial(sessionOptions);
  if (!cached) {
    const enrollment = await createPortableVaultBrokerEnrollmentPackage(input);
    try {
      assertVaultSessionMutationAllowed(input.operation);
      return enrollment;
    } catch (error) {
      enrollment.dispose();
      throw error;
    }
  }

  const puk = generatePortableVaultUnlockKey();
  try {
    const encryptedVaultKey = await createPortableVaultBrokerEncryptedVaultKeyFromCachedMaterial(
      input.vaultKey,
      puk,
      input.opaqueScope,
      input.profile,
      { innerVaultKeyBlob: cached.inner, wrappingKey: cached.wrappingKey }
    );
    assertVaultSessionMutationAllowed(input.operation);
    return { puk, encryptedVaultKey, dispose: () => puk.fill(0) };
  } catch (error) {
    puk.fill(0);
    assertVaultSessionMutationAllowed(input.operation);
    clearVaultInnerKeyMaterialCache(sessionOptions);
    if (error instanceof VaultAuthorizationError) {
      throw new VaultAuthorizationError(INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE);
    }
    throw error;
  }
}

export type PortableVaultBrokerEphemeralPublicJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
};

export type PortableVaultBrokerUnlockSession = {
  publicJwk: PortableVaultBrokerEphemeralPublicJwk;
  thumbprint: string;
  /** One-shot authenticated decryption. The private key is dropped after this call. */
  unseal: (sealed: PortableVaultBrokerSealedPuk) => Promise<Uint8Array>;
  dispose: () => void;
};

function assertPublicJwk(value: JsonWebKey): PortableVaultBrokerEphemeralPublicJwk {
  /* v8 ignore next -- generated P-256 public keys satisfy this defensive runtime invariant */
  if (
    value.kty !== "EC" ||
    value.crv !== "P-256" ||
    typeof value.x !== "string" ||
    typeof value.y !== "string" ||
    value.d !== undefined
  ) {
    throw new Error("Ephemeral public key must be a public P-256 JWK");
  }
  return { kty: "EC", crv: "P-256", x: value.x, y: value.y };
}

async function publicJwkThumbprint(jwk: PortableVaultBrokerEphemeralPublicJwk): Promise<string> {
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function unsealPuk(
  privateKey: CryptoKey,
  sealed: PortableVaultBrokerSealedPuk
): Promise<Uint8Array> {
  const brokerPublicKey = await crypto.subtle.importKey(
    "jwk",
    sealed.brokerPublicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: brokerPublicKey }, privateKey, 256)
  );
  let salt: Uint8Array | null = null;
  let iv: Uint8Array | null = null;
  let ciphertext: Uint8Array | null = null;
  let info: Uint8Array | null = null;
  try {
    salt = decodeBoundedBase64Url(sealed.salt, ECDH_SALT_BYTES);
    iv = decodeBoundedBase64Url(sealed.iv, AES_GCM_IV_BYTES);
    ciphertext = decodeBoundedBase64Url(sealed.ciphertext, SEALED_PUK_BYTES);
    if (
      salt.byteLength !== ECDH_SALT_BYTES ||
      iv.byteLength !== AES_GCM_IV_BYTES ||
      ciphertext.byteLength !== SEALED_PUK_BYTES
    ) {
      throw new Error("Sealed portable unlock key has invalid field lengths");
    }
    info = new TextEncoder().encode(`vault-broker:puk-seal:v1:${sealed.context}`);
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      toBufferSource(sharedBits),
      "HKDF",
      false,
      ["deriveKey"]
    );
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toBufferSource(salt),
        info: toBufferSource(info),
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toBufferSource(iv),
          additionalData: toBufferSource(info),
          tagLength: 128,
        },
        encryptionKey,
        toBufferSource(ciphertext)
      )
    );
    /* v8 ignore next -- a valid 48-byte AES-GCM value decrypts to exactly 32 bytes */
    if (plaintext.byteLength !== PUK_BYTES) {
      plaintext.fill(0);
      throw new Error("Broker returned an invalid portable unlock key");
    }
    return plaintext;
  } finally {
    sharedBits.fill(0);
    salt?.fill(0);
    iv?.fill(0);
    ciphertext?.fill(0);
    info?.fill(0);
  }
}

/** Creates a non-extractable, one-use P-256 key bound into the broker unlock grant. */
export async function createPortableVaultBrokerUnlockSession(): Promise<PortableVaultBrokerUnlockSession> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  const publicJwk = assertPublicJwk(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const thumbprint = await publicJwkThumbprint(publicJwk);
  let privateKey: CryptoKey | null = pair.privateKey;
  return {
    publicJwk,
    thumbprint,
    async unseal(sealed) {
      if (!privateKey) throw new Error("Portable broker unlock session has already been consumed");
      const oneUseKey = privateKey;
      privateKey = null;
      return unsealPuk(oneUseKey, sealed);
    },
    dispose() {
      privateKey = null;
    },
  };
}

export type PortableVaultBrokerClientUnlockResult =
  | {
      status: "unlocked";
      vaultKey: CryptoKey;
      requestId: string;
      completionReceipt: string;
    }
  | { status: "malformed_response"; error: unknown }
  | { status: "puk_unseal_failed"; error: unknown }
  | { status: "completion_receipt_rejected"; error: unknown }
  | { status: "vault_key_unwrap_failed"; error: unknown };

export type PortableVaultBrokerClientUnlockInput = {
  response: unknown;
  session: PortableVaultBrokerUnlockSession;
  expectedOpaqueScope: PortableVaultOpaqueAadScope;
  profile: VaultCryptoProfile;
} & (
  | {
      operation: VaultSessionOperation;
      verifyAndConsumeCompletionReceipt: (receipt: string) => Promise<void>;
    }
  | {
      operation?: undefined;
      verifyAndConsumeCompletionReceipt?: undefined;
    }
);

/**
 * Validates the broker response, opens the PUK only in the bound browser session, then restores a
 * non-extractable UVK. The PUK bytes are zeroed before this function returns.
 */
export async function unlockPortableVaultBrokerResponse(
  input: PortableVaultBrokerClientUnlockInput
): Promise<PortableVaultBrokerClientUnlockResult> {
  assertVaultSessionMutationAllowed(input.operation);
  if (input.operation && !input.verifyAndConsumeCompletionReceipt) {
    throw new TypeError(
      "A completion receipt verifier is required when portable unlock populates the session cache."
    );
  }
  let response: PortableVaultBrokerUnlockResponse;
  try {
    response = portableVaultBrokerUnlockResponseSchema.parse(input.response);
    encryptedPayloadSchema.parse(response.encryptedVaultKey);
  } catch (error) {
    input.session.dispose();
    return { status: "malformed_response", error };
  }

  let puk: Uint8Array;
  try {
    puk = await input.session.unseal(response.sealedPuk);
  } catch (error) {
    return { status: "puk_unseal_failed", error };
  }

  try {
    if (input.operation) {
      const restored = await unlockPortableVaultBrokerEncryptedVaultKeyWithInnerMaterial(
        response.encryptedVaultKey,
        puk,
        input.expectedOpaqueScope,
        input.profile
      );
      try {
        await input.verifyAndConsumeCompletionReceipt!(response.completionReceipt);
      } catch (error) {
        restored.innerVaultKeyBlob.fill(0);
        return { status: "completion_receipt_rejected", error };
      }
      await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
        restored.innerVaultKeyBlob,
        restored.wrappingKey,
        restored.vaultKey,
        { operation: input.operation }
      );
      assertVaultSessionMutationAllowed(input.operation);
      return {
        status: "unlocked",
        vaultKey: restored.vaultKey,
        requestId: response.requestId,
        completionReceipt: response.completionReceipt,
      };
    }

    const vaultKey = await unlockPortableVaultBrokerEncryptedVaultKey(
      response.encryptedVaultKey,
      puk,
      input.expectedOpaqueScope,
      input.profile
    );
    assertVaultSessionMutationAllowed(input.operation);
    return {
      status: "unlocked",
      vaultKey,
      requestId: response.requestId,
      completionReceipt: response.completionReceipt,
    };
  } catch (error) {
    return { status: "vault_key_unwrap_failed", error };
  } finally {
    puk.fill(0);
  }
}

export function isPortableVaultBrokerUnlockResponse(
  value: unknown
): value is PortableVaultBrokerUnlockResponse {
  return portableVaultBrokerUnlockResponseSchema.safeParse(value).success;
}

export const portableVaultBrokerEnrollmentRequestSchema = z.object({
  puk: z.string().min(43).max(43),
  encryptedVaultKey: encryptedPayloadSchema,
}).strict();

export type PortableVaultBrokerEnrollmentRequest = z.infer<
  typeof portableVaultBrokerEnrollmentRequestSchema
>;

/** Creates the exact JSON payload expected by the broker. Dispose the package immediately after. */
export function serializePortableVaultBrokerEnrollmentPackage(
  enrollment: Pick<PortableVaultBrokerEnrollmentPackage, "puk" | "encryptedVaultKey">
): PortableVaultBrokerEnrollmentRequest {
  if (enrollment.puk.byteLength !== PUK_BYTES) {
    throw new Error("Portable unlock key must be exactly 32 bytes");
  }
  return portableVaultBrokerEnrollmentRequestSchema.parse({
    puk: bytesToBase64Url(enrollment.puk),
    encryptedVaultKey: enrollment.encryptedVaultKey,
  });
}
