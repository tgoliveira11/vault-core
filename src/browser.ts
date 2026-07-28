export {
  extractPasskeyPrfOutput,
  prfBytesForAes256Import,
  type ExtractPasskeyPrfOutputOptions,
} from "./envelopes/passkey-prf-output.js";

export {
  isPasskeySupported,
  isPrfExtensionHeuristicallyAvailable,
  isPrfExtensionSupported,
  resolvePasskeyPrfCapability,
  type PasskeyPrfCapability,
  type ResolvePasskeyPrfCapabilityInput,
} from "./envelopes/passkey-prf.js";

export {
  MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES,
  unlockWithPasskeyPrfEnvelopeCandidates,
  type PasskeyPrfEnvelopeCandidateMalformedReason,
  type UnlockPasskeyPrfEnvelopeCandidatesInput,
  type UnlockPasskeyPrfEnvelopeCandidatesResult,
} from "./envelopes/passkey-prf-candidates.js";

export {
  DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION,
  parseAppleMobileOsMajorVersion,
  type PrfExtensionSupportOptions,
} from "./envelopes/passkey-prf-support.js";

export {
  alignPrfExtensionsForCredential,
  prepareWebAuthnPrfExtensions,
  type PublicKeyCredentialRequestOptionsInput,
  type PublicKeyCredentialCreationOptionsInput,
  type WebAuthnExtensionsInput,
  type WebAuthnPrfExtensionInput,
} from "./browser/webauthn-prf-options.js";

export {
  prepareVaultPasskeyPrfRegistrationOptions,
  type PrepareVaultPasskeyPrfRegistrationOptionsInput,
} from "./browser/vault-passkey-prf-registration-options.js";

export {
  resolvePasskeyPrfEnrollmentAfterRegistration,
  type PasskeyPrfEnrollmentAfterRegistrationResult,
  type ResolvePasskeyPrfEnrollmentAfterRegistrationInput,
} from "./browser/passkey-prf-enrollment.js";

export {
  isAppleMobileUserAgent,
  applyVaultUnlockTransportPolicy,
  preferPlatformTransportsForVaultUnlock,
  resolveVaultUnlockUserAgent,
  type VaultUnlockTransportPolicy,
} from "./browser/vault-unlock-transports.js";

export {
  prepareVaultUnlockAuthenticationOptions,
  type PrepareVaultUnlockAuthenticationOptionsContext,
} from "./browser/vault-unlock-auth-options.js";

export {
  prepareVaultPasskeyPrfAuthenticationOptions,
  type PrepareVaultPasskeyPrfAuthenticationOptionsInput,
} from "./browser/vault-passkey-prf-auth-options.js";

export {
  sanitizeWebAuthnResponseForServer,
  type WebAuthnResponseWithClientExtensionResults,
  type WebAuthnResponseWithoutPrfResults,
} from "./browser/webauthn-response-sanitize.js";

export {
  buildPasskeyPrfAuthenticationExtensionsJson,
  buildPrfSaltBytes,
  type PasskeyPrfAuthenticationExtensionsJson,
} from "./browser/prf-salt-bytes.js";

export function createRecoveryKitDownload(
  content: string,
  filename: string
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printRecoveryKitContent(content: string): void {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=640,height=720");
  if (!printWindow) return;
  printWindow.document.write(
    `<pre style="font-family:monospace;white-space:pre-wrap;padding:24px;">${escapeHtml(content)}</pre>`
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type VaultStorageInspectionResult = "clear" | "found" | "unavailable";

export function inspectLocalStoragePrefix(
  storagePrefix: string
): VaultStorageInspectionResult {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "unavailable";
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(storagePrefix)) {
        return "found";
      }
    }
    return "clear";
  } catch {
    return "unavailable";
  }
}

export async function inspectIndexedDBPrefix(
  storagePrefix: string
): Promise<VaultStorageInspectionResult> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return "unavailable";
  }

  return new Promise((resolve) => {
    let request: Promise<IDBDatabaseInfo[]> | undefined;
    try {
      request = indexedDB.databases?.();
    } catch {
      resolve("unavailable");
      return;
    }
    if (!request) {
      resolve("unavailable");
      return;
    }
    void request
      .then((databases) => {
        const hasVaultDb = databases.some((db) => db.name?.startsWith(storagePrefix));
        resolve(hasVaultDb ? "found" : "clear");
      })
      .catch(() => resolve("unavailable"));
  });
}

/**
 * @deprecated This is a namespace-level, fail-closed check. Use inspectLocalStoragePrefix
 * and handle all three result states explicitly.
 */
export function assertNoDecryptedVaultInLocalStorage(storagePrefix: string): boolean {
  return inspectLocalStoragePrefix(storagePrefix) === "clear";
}

/**
 * @deprecated This checks database names, not record contents. Use inspectIndexedDBPrefix
 * and handle all three result states explicitly.
 */
export async function assertNoDecryptedVaultInIndexedDB(storagePrefix: string): Promise<boolean> {
  return (await inspectIndexedDBPrefix(storagePrefix)) === "clear";
}

export function persistVaultRecordLocally(): never {
  throw new Error("Decrypted vault state must not be persisted to localStorage or IndexedDB");
}

export {
  createPasskeyPrfEnvelopeWithSessionCache,
  type CreatePasskeyPrfEnvelopeOptions,
  type CreatePasskeyPrfEnvelopeWithSessionCacheOptions,
} from "./envelopes/passkey-prf.js";

export {
  VaultInnerKeyMaterialCache,
  cacheVaultInnerKeyMaterialAfterPasswordUnlock,
  cacheVaultInnerKeyMaterialAfterRecoveryUnlock,
  cacheVaultInnerKeyMaterialFromPasskeyUnlock,
  cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  cacheVaultInnerKeyMaterialFromPasskeyEnvelope,
  clearVaultInnerKeyMaterialCache,
  getCachedVaultInnerKeyMaterial,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
  resolveInnerVaultKeyBlobForWrap,
  type VaultInnerKeyMaterialCacheEntry,
} from "./browser/inner-key-material-cache.js";


export {
  deleteVaultAfterAuthorization,
  deleteVaultWithPasswordAuthorization,
  type DeleteVaultAfterAuthorizationOptions,
  type DeleteVaultWithPasswordAuthorizationOptions,
} from "./session/vault-deletion.js";

export {
  clampVaultAutoLockMinutes,
  clearUserVaultAutoLockMinutes,
  DEFAULT_USER_VAULT_AUTO_LOCK_STORAGE_KEY,
  readUserVaultAutoLockMinutes,
  resolveVaultAutoLockMinutesPreference,
  writeUserVaultAutoLockMinutes,
  VAULT_USER_AUTO_LOCK_MIN_MINUTES,
  type ResolveVaultAutoLockMinutesOptions,
} from "./session/user-auto-lock-preference.js";

export {
  configureVaultSession,
  subscribeVaultSession,
  isVaultManuallyLocked,
  clearVaultAutoLockTimer,
  scheduleVaultAutoLock,
  touchVaultSession,
  beginVaultSessionUnlock,
  beginVaultSessionOperation,
  clearVaultSessionOwner,
  unlockVaultSession,
  lockVaultSession,
  lockVaultSessionManually,
  resetVaultSessionLockState,
  registerVaultUnloadGuard,
  registerVaultActivityGuard,
  suppressVaultActivity,
  getVaultAutoLockRemainingMs,
  getVaultAutoLockMinutes,
  getSessionVaultKey,
  isVaultUnlocked,
  getVaultSessionMode,
  isVaultEmergencyMode,
  enterVaultEmergencyMode,
  isEmergencyModePinned,
  getSessionKeyRole,
  clearEmergencyModePin,
  type VaultSessionConfig,
  type VaultSessionMode,
  type VaultSessionKeyRole,
} from "./session/auto-lock.js";

export {
  assertVaultSessionOperationCurrent,
  assertVaultSessionUnlockAttemptCurrent,
  assertVaultSessionLeaseCurrent,
  captureVaultSessionLease,
  getVaultSessionSnapshot,
  isVaultSessionOperationCurrent,
  isVaultSessionUnlockAttemptCurrent,
  isVaultSessionLeaseCurrent,
  VaultSessionOperationCancelledError,
  type VaultSessionMutationOptions,
  type VaultSessionLease,
  type VaultSessionOperation,
  type VaultSessionOperationCancellationReason,
  type VaultSessionSnapshot,
  type VaultSessionUnlockAttempt,
} from "./session/vault-session-operation.js";

export {
  registerVaultLockCleanup,
  type VaultLockCleanupHandler,
} from "./session/vault-lock-cleanup.js";

export {
  unlockVaultWithPasswordRouting,
  unlockVaultWithPasskeyRouting,
  unlockVaultWithPasskeyCandidateRouting,
  exitEmergencyMode,
  hydrateVaultEmergencyModeFromServer,
  type EmergencyUnlockPasswordInput,
  type EmergencyUnlockPasskeyInput,
  type EmergencyUnlockPasskeyCandidateInput,
  type EmergencyUnlockPasskeyCandidateResult,
  type ExitEmergencyModeInput,
} from "./emergency/browser-emergency.js";

export { createRecoveryKitText, buildRecoveryKitContent } from "./recovery/kit.js";
