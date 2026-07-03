import type { EncryptedVaultPayload } from "../validation/schemas.js";
import type { VaultAadScope, VaultCryptoProfile } from "../profile.js";
import { normalizeEnvelopeAadContext } from "../validation/envelope-aad-normalize.js";
import { assertVaultKeyAad } from "../validation/aad-assert.js";

type VaultKeyScope = Pick<VaultAadScope, "userId" | "resourceId">;

export function isLegacyVaultKeyEnvelope(
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): boolean {
  if (payload.aad.field !== "vault_key") {
    return false;
  }

  const context = payload.aad.context as string | null | undefined;
  return context === undefined || context === null || context !== profile.aadContextEnvelope;
}

function legacyVaultKeyPayloadCandidates(
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): EncryptedVaultPayload[] {
  const base = payload.aad;
  const contexts = new Set<string | undefined>();

  contexts.add(profile.aadContextEnvelope);
  contexts.add(undefined);
  if (base.context !== undefined && base.context !== null) {
    contexts.add(base.context);
  }

  return Array.from(contexts).map((context) => ({
    ...payload,
    aad: {
      ...base,
      ...(context === undefined ? {} : { context }),
    },
  }));
}

function assertVaultKeyScope(
  expectedScope: VaultKeyScope,
  payload: EncryptedVaultPayload
): void {
  if (payload.aad.userId !== expectedScope.userId) {
    throw new Error("Vault key AAD userId mismatch");
  }
  if (payload.aad.resourceId !== expectedScope.resourceId) {
    throw new Error("Vault key AAD resourceId mismatch");
  }
  if (payload.aad.field !== "vault_key") {
    throw new Error("Vault key AAD field mismatch");
  }
}

/**
 * Attempts vault-key unwrap across canonical and legacy AAD context variants.
 */
export async function unwrapVaultKeyWithLegacyAadFallback(
  payload: EncryptedVaultPayload,
  decryptFn: (candidate: EncryptedVaultPayload) => Promise<CryptoKey>,
  expectedScope: VaultKeyScope,
  profile: VaultCryptoProfile
): Promise<CryptoKey> {
  let lastError: unknown;

  for (const candidate of legacyVaultKeyPayloadCandidates(payload, profile)) {
    try {
      assertVaultKeyScope(expectedScope, candidate);
      return await decryptFn(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Legacy vault key unwrap failed");
}

export async function unlockVaultKeyEnvelopeWithAadRouting(
  payload: EncryptedVaultPayload,
  expectedScope: VaultKeyScope,
  profile: VaultCryptoProfile,
  decryptFn: (candidate: EncryptedVaultPayload) => Promise<CryptoKey>
): Promise<CryptoKey> {
  const legacyEnabled = profile.legacyVaultKeyUnlock !== false;

  if (legacyEnabled && isLegacyVaultKeyEnvelope(payload, profile)) {
    return unwrapVaultKeyWithLegacyAadFallback(payload, decryptFn, expectedScope, profile);
  }

  const normalized = normalizeEnvelopeAadContext(payload, profile);
  assertVaultKeyAad(expectedScope, normalized, profile);
  return decryptFn(normalized);
}
