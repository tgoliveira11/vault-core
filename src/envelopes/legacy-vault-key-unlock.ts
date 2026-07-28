import type { EncryptedVaultPayload } from "../validation/schemas.js";
import type { VaultAadScope, VaultCryptoProfile } from "../profile.js";
import { normalizeEnvelopeAadContext } from "../validation/envelope-aad-normalize.js";
import { assertVaultKeyAad } from "../validation/aad-assert.js";

type VaultKeyScope = Pick<VaultAadScope, "userId" | "resourceId">;

type PersistedVaultKeyAadContext = string | null | undefined;

/**
 * Returns true only for the canonical context or a profile-authorized legacy context.
 * Missing/null contexts remain compatible while legacy unlock is enabled. Explicit legacy
 * strings must be allowlisted so compatibility cannot silently disable AAD domain separation.
 */
export function isVaultKeyAadContextAllowed(
  context: PersistedVaultKeyAadContext,
  profile: VaultCryptoProfile
): boolean {
  if (context === profile.aadContextEnvelope) {
    return true;
  }
  if (profile.legacyVaultKeyUnlock === false) {
    return false;
  }
  if (context === undefined || context === null) {
    return true;
  }
  return profile.legacyVaultKeyAadContexts?.includes(context) === true;
}

export function isLegacyVaultKeyEnvelope(
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): boolean {
  if (payload.aad.field !== "vault_key") {
    return false;
  }

  const context = payload.aad.context;
  return context === undefined || context === null || context !== profile.aadContextEnvelope;
}

function legacyVaultKeyPayloadCandidates(
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): EncryptedVaultPayload[] {
  const { context: storedContext, ...baseWithoutContext } = payload.aad;
  const contexts = new Set<PersistedVaultKeyAadContext>();

  contexts.add(profile.aadContextEnvelope);
  contexts.add(undefined);
  if (storedContext === null) {
    contexts.add(null);
  } else if (
    typeof storedContext === "string" &&
    profile.legacyVaultKeyAadContexts?.includes(storedContext)
  ) {
    contexts.add(storedContext);
  }

  return Array.from(contexts).map((context) => ({
    ...payload,
    aad: {
      ...baseWithoutContext,
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
  assertVaultKeyScope(expectedScope, payload);
  if (!isVaultKeyAadContextAllowed(payload.aad.context, profile)) {
    throw new Error("Vault key AAD context mismatch");
  }

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

  if (!legacyEnabled && isLegacyVaultKeyEnvelope(payload, profile)) {
    throw new Error("Vault key AAD context mismatch");
  }

  if (legacyEnabled && isLegacyVaultKeyEnvelope(payload, profile)) {
    if (!isVaultKeyAadContextAllowed(payload.aad.context, profile)) {
      throw new Error("Vault key AAD context mismatch");
    }
    return unwrapVaultKeyWithLegacyAadFallback(payload, decryptFn, expectedScope, profile);
  }

  const normalized = normalizeEnvelopeAadContext(payload, profile);
  assertVaultKeyAad(expectedScope, normalized, profile);
  return decryptFn(normalized);
}
