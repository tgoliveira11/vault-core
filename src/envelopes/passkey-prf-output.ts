import { base64UrlToBytes } from "../crypto/encoding.js";

export type ExtractPasskeyPrfOutputOptions = {
  /** WebAuthn credential id (typically base64url) to prefer evalByCredential entries. */
  credentialId?: string;
};

type PrfResultEntry = {
  first?: unknown;
};

/** Returns an owned 32-byte snapshot of PRF extension bytes for AES-256 import. */
export function prfBytesForAes256Import(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength < 32) {
    throw new Error("PRF output must be at least 32 bytes");
  }
  return bytes.slice(0, 32);
}

type CoercedExtensionBytes = { bytes: Uint8Array; owned: boolean };

function coerceExtensionBytesToUint8Array(value: unknown): CoercedExtensionBytes | null {
  if (value instanceof ArrayBuffer) {
    return { bytes: new Uint8Array(value), owned: false };
  }

  if (ArrayBuffer.isView(value)) {
    return {
      bytes: new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      owned: false,
    };
  }

  if (typeof value === "string") {
    try {
      return { bytes: base64UrlToBytes(value), owned: true };
    } catch {
      return null;
    }
  }

  if (Array.isArray(value) && value.length >= 32 && value.every((entry) => typeof entry === "number")) {
    return { bytes: new Uint8Array(value), owned: true };
  }

  return null;
}

function pickPrfResultFirst(entry: unknown): Uint8Array | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const coerced = coerceExtensionBytesToUint8Array((entry as PrfResultEntry).first);
  if (!coerced) {
    return null;
  }
  try {
    if (coerced.bytes.byteLength < 32) {
      return null;
    }
    return prfBytesForAes256Import(coerced.bytes);
  } finally {
    if (coerced.owned) coerced.bytes.fill(0);
  }
}

function pickFirstInEvalByCredentialMap(evalByCredential: unknown): Uint8Array | null {
  if (!evalByCredential || typeof evalByCredential !== "object") {
    return null;
  }

  for (const entry of Object.values(evalByCredential as Record<string, unknown>)) {
    const picked = pickPrfResultFirst(entry);
    if (picked) {
      return picked;
    }
  }

  return null;
}

/**
 * Extracts the first PRF output from WebAuthn client extension results.
 *
 * Preference order:
 * 1. `prf.evalByCredential[credentialId].first` when `credentialId` is provided
 * 2. `prf.results.first`
 * 3. First `.first` value in `prf.evalByCredential`
 */
export function extractPasskeyPrfOutput(
  clientExtensionResults: Record<string, unknown>,
  options?: ExtractPasskeyPrfOutputOptions
): Uint8Array | null {
  const prf = clientExtensionResults.prf;
  if (!prf || typeof prf !== "object") {
    return null;
  }

  const prfRecord = prf as Record<string, unknown>;

  if (options?.credentialId) {
    const evalByCredential = prfRecord.evalByCredential;
    if (evalByCredential && typeof evalByCredential === "object") {
      const picked = pickPrfResultFirst(
        (evalByCredential as Record<string, unknown>)[options.credentialId]
      );
      if (picked) {
        return picked;
      }
    }
  }

  const fromResults = pickPrfResultFirst(prfRecord.results);
  if (fromResults) {
    return fromResults;
  }

  return pickFirstInEvalByCredentialMap(prfRecord.evalByCredential);
}
