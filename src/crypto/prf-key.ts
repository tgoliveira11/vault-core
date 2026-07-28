const PRF_AES_KEY_LENGTH_BYTES = 32;

function isUint8Array(value: unknown): value is Uint8Array {
  return ArrayBuffer.isView(value) &&
    Object.prototype.toString.call(value) === "[object Uint8Array]";
}

function snapshotPrfAes256Bytes(prfOutput: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!isUint8Array(prfOutput) || prfOutput.byteLength < PRF_AES_KEY_LENGTH_BYTES) {
    throw new Error("PRF output must be a Uint8Array with at least 32 bytes");
  }
  const snapshot = new Uint8Array(new ArrayBuffer(PRF_AES_KEY_LENGTH_BYTES));
  snapshot.set(prfOutput.subarray(0, PRF_AES_KEY_LENGTH_BYTES));
  return snapshot;
}

async function importPrfAesKey(
  prfOutput: Uint8Array,
  algorithm: "AES-GCM" | "AES-KW",
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const keyBytes = snapshotPrfAes256Bytes(prfOutput);
  try {
    return await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: algorithm, length: 256 },
      false,
      usages
    );
  } finally {
    keyBytes.fill(0);
  }
}

export function importPrfAesGcmKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  return importPrfAesKey(prfOutput, "AES-GCM", ["encrypt", "decrypt"]);
}

export function importPrfAesKwKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  return importPrfAesKey(prfOutput, "AES-KW", ["wrapKey", "unwrapKey"]);
}
