import { assertNoVaultPlaintextFields } from "./plaintext-reject.js";

const MAX_PUBLIC_METADATA_BYTES = 4_096;
const MAX_PUBLIC_METADATA_DEPTH = 6;
const MAX_PUBLIC_METADATA_ENTRIES = 64;
const MAX_PUBLIC_METADATA_KEY_LENGTH = 128;

function assertJsonMetadataValue(value: unknown, depth: number, seen: WeakSet<object>): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }
  if (typeof value !== "object") {
    throw new TypeError("Vault public metadata must contain JSON values only");
  }
  if (depth > MAX_PUBLIC_METADATA_DEPTH) {
    throw new TypeError("Vault public metadata exceeds the maximum depth");
  }
  if (seen.has(value)) {
    throw new TypeError("Vault public metadata must not contain circular references");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > MAX_PUBLIC_METADATA_ENTRIES) {
      throw new TypeError("Vault public metadata exceeds the maximum array length");
    }
    for (const entry of value) assertJsonMetadataValue(entry, depth + 1, seen);
    seen.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Vault public metadata must contain plain objects only");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PUBLIC_METADATA_ENTRIES) {
    throw new TypeError("Vault public metadata exceeds the maximum object size");
  }
  for (const [key, entry] of entries) {
    if (key.length === 0 || key.length > MAX_PUBLIC_METADATA_KEY_LENGTH) {
      throw new TypeError("Vault public metadata contains an invalid key");
    }
    assertJsonMetadataValue(entry, depth + 1, seen);
  }
  seen.delete(value);
}

/** Validates newly created server-visible vault metadata without changing legacy parse behavior. */
export function assertSafeVaultPublicMetadata(metadata: Record<string, unknown>): void {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("Vault public metadata must be a plain object");
  }
  assertNoVaultPlaintextFields(metadata);
  assertJsonMetadataValue(metadata, 0, new WeakSet<object>());
  const json = JSON.stringify(metadata);
  if (new TextEncoder().encode(json).byteLength > MAX_PUBLIC_METADATA_BYTES) {
    throw new TypeError("Vault public metadata exceeds 4096 bytes");
  }
}
