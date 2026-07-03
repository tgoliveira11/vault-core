import { base64UrlToBytes } from "../crypto/encoding.js";

export type ExtractPasskeyPrfOutputOptions = {
  /** WebAuthn credential id (typically base64url) to prefer evalByCredential entries. */
  credentialId?: string;
};

type PrfResultEntry = {
  first?: unknown;
};

/** Normalizes PRF extension bytes to exactly 32 bytes for AES-256 import. */
export function prfBytesForAes256Import(bytes: Uint8Array): Uint8Array {
  return bytes.byteLength === 32 ? bytes : bytes.slice(0, 32);
}

function coerceExtensionBytesToUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (typeof value === "string") {
    try {
      return base64UrlToBytes(value);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value) && value.length >= 32 && value.every((entry) => typeof entry === "number")) {
    return new Uint8Array(value);
  }

  return null;
}

function pickPrfResultFirst(entry: unknown): Uint8Array | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const bytes = coerceExtensionBytesToUint8Array((entry as PrfResultEntry).first);
  if (!bytes || bytes.byteLength < 32) {
    return null;
  }

  return prfBytesForAes256Import(bytes);
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
