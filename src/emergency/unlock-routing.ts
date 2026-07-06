import type { EncryptedVaultPayload } from "../validation/schemas.js";
import { VaultEmergencyDecryptError } from "../errors/vault-errors.js";
import { containsDuressSequence } from "./contains-duress-sequence.js";

export type VaultUnlockTarget = "primary" | "decoy";

export type ResolveVaultUnlockTargetInput = {
  /** Entered vault password (password unlock path). */
  password?: string;
  /** User-configured duress sequence (non-secret signal). */
  duressSequence?: string | null;
  /** Long-press latch for passkey unlock. */
  duressSignaled?: boolean;
  /** Server-persisted or session-pinned emergency flag. */
  emergencyModeActive: boolean;
};

/**
 * Selects primary vs decoy envelope routing for password or passkey unlock.
 */
export function resolveVaultUnlockTarget(input: ResolveVaultUnlockTargetInput): VaultUnlockTarget {
  if (input.emergencyModeActive) {
    return "decoy";
  }
  if (input.duressSignaled) {
    return "decoy";
  }
  if (input.password != null && input.duressSequence) {
    if (containsDuressSequence(input.password, input.duressSequence)) {
      return "decoy";
    }
  }
  return "primary";
}

/**
 * Returns the encrypted blob appropriate for the active session mode.
 */
export function resolveSessionEncryptedBlob(input: {
  mode: "normal" | "emergency";
  primaryBlob: EncryptedVaultPayload;
  decoyBlob?: EncryptedVaultPayload | null;
}): EncryptedVaultPayload {
  if (input.mode === "emergency") {
    if (!input.decoyBlob) {
      throw new VaultEmergencyDecryptError(
        "Emergency mode is active but no decoy encrypted blob is configured."
      );
    }
    return input.decoyBlob;
  }
  return input.primaryBlob;
}

/**
 * Refuses decrypt when emergency mode is active and the caller targets the primary blob.
 */
export function assertSessionPayloadDecryptAllowed(input: {
  mode: "normal" | "emergency";
  targetBlob: EncryptedVaultPayload;
  primaryBlob: EncryptedVaultPayload;
}): void {
  if (input.mode !== "emergency") return;
  if (blobsReferentiallyEqual(input.targetBlob, input.primaryBlob)) {
    throw new VaultEmergencyDecryptError(
      "Primary vault payload cannot be decrypted while emergency mode is active."
    );
  }
}

function blobsReferentiallyEqual(
  a: EncryptedVaultPayload,
  b: EncryptedVaultPayload
): boolean {
  return (
    a.ciphertext === b.ciphertext &&
    a.iv === b.iv &&
    a.version === b.version &&
    a.alg === b.alg
  );
}
