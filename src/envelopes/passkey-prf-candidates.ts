import {
  MAX_VAULT_CIPHERTEXT_BYTES,
  MAX_VAULT_IV_BYTES,
} from "../constants.js";
import { decodeBoundedBase64Url } from "../crypto/encoding.js";
import type { VaultAadScope, VaultCryptoProfile } from "../profile.js";
import { vaultPasskeyEnvelopeVariantSchema } from "../passkey/model.js";
import type { VaultPasskeyEnvelopeVariant } from "../passkey/model.js";
import { unwrapVaultKeyFromPasskey } from "./passkey-prf.js";
import { isVaultKeyAadContextAllowed } from "./legacy-vault-key-unlock.js";

export const MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES = 5;

type CandidateScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type UnlockPasskeyPrfEnvelopeCandidatesInput = {
  verifiedCredentialId: string;
  candidates: readonly unknown[];
  prfOutput: Uint8Array | null;
  expectedScope: CandidateScope;
  profile: VaultCryptoProfile;
};

export type PasskeyPrfEnvelopeCandidateMalformedReason =
  | "candidate_limit_exceeded"
  | "invalid_candidate"
  | "duplicate_variant_id"
  | "credential_mismatch"
  | "scope_mismatch";

export type UnlockPasskeyPrfEnvelopeCandidatesResult =
  | { status: "matched"; envelopeVariantId: string; vaultKey: CryptoKey }
  | { status: "no_match"; attemptedCandidateCount: number }
  | { status: "prf_unavailable" }
  | {
      status: "malformed_candidate";
      reason: PasskeyPrfEnvelopeCandidateMalformedReason;
      candidateIndex: number | null;
    }
  | {
      status: "crypto_failure";
      reason: "crypto_unavailable" | "unexpected_crypto_error";
      candidateIndex: number | null;
    };

function isCandidateCryptoMismatch(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "OperationError" || error.name === "DataError";
  }
  if (error instanceof Error) {
    return error.name === "OperationError" || error.name === "DataError";
  }
  return false;
}

/**
 * Tries a bounded set of variants for one server-verified credential entirely in the client.
 * The result contains no PRF output or hash and never mutates/revokes a candidate.
 */
export async function unlockWithPasskeyPrfEnvelopeCandidates(
  input: UnlockPasskeyPrfEnvelopeCandidatesInput
): Promise<UnlockPasskeyPrfEnvelopeCandidatesResult> {
  if (!(input.prfOutput instanceof Uint8Array) || input.prfOutput.byteLength < 32) {
    return { status: "prf_unavailable" };
  }

  if (!Array.isArray(input.candidates) || input.candidates.length > MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES) {
    return {
      status: "malformed_candidate",
      reason: "candidate_limit_exceeded",
      candidateIndex: null,
    };
  }

  const parsedCandidates: VaultPasskeyEnvelopeVariant[] = [];
  const variantIds = new Set<string>();

  for (let index = 0; index < input.candidates.length; index += 1) {
    const parsed = vaultPasskeyEnvelopeVariantSchema.safeParse(input.candidates[index]);
    if (!parsed.success) {
      return {
        status: "malformed_candidate",
        reason: "invalid_candidate",
        candidateIndex: index,
      };
    }

    const candidate = parsed.data;
    if (variantIds.has(candidate.envelopeVariantId)) {
      return {
        status: "malformed_candidate",
        reason: "duplicate_variant_id",
        candidateIndex: index,
      };
    }
    variantIds.add(candidate.envelopeVariantId);

    if (candidate.credentialId !== input.verifiedCredentialId) {
      return {
        status: "malformed_candidate",
        reason: "credential_mismatch",
        candidateIndex: index,
      };
    }

    const aad = candidate.envelope.encryptedVaultKey.aad;
    if (
      aad.userId !== input.expectedScope.userId ||
      aad.resourceId !== input.expectedScope.resourceId ||
      aad.field !== "vault_key" ||
      !isVaultKeyAadContextAllowed(aad.context, input.profile)
    ) {
      return {
        status: "malformed_candidate",
        reason: "scope_mismatch",
        candidateIndex: index,
      };
    }

    try {
      decodeBoundedBase64Url(
        candidate.envelope.encryptedVaultKey.iv,
        MAX_VAULT_IV_BYTES
      );
      decodeBoundedBase64Url(
        candidate.envelope.encryptedVaultKey.ciphertext,
        MAX_VAULT_CIPHERTEXT_BYTES
      );
    } catch {
      return {
        status: "malformed_candidate",
        reason: "invalid_candidate",
        candidateIndex: index,
      };
    }

    parsedCandidates.push(candidate);
  }

  for (let index = 0; index < parsedCandidates.length; index += 1) {
    const candidate = parsedCandidates[index]!;
    try {
      const vaultKey = await unwrapVaultKeyFromPasskey(
        candidate.envelope.encryptedVaultKey,
        input.prfOutput,
        input.expectedScope,
        input.profile
      );
      return {
        status: "matched",
        envelopeVariantId: candidate.envelopeVariantId,
        vaultKey,
      };
    } catch (error) {
      if (isCandidateCryptoMismatch(error)) {
        continue;
      }
      return {
        status: "crypto_failure",
        reason:
          error instanceof TypeError ? "crypto_unavailable" : "unexpected_crypto_error",
        candidateIndex: index,
      };
    }
  }

  return { status: "no_match", attemptedCandidateCount: parsedCandidates.length };
}
